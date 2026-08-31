-- Native ArteInsumos checkout: atomic pending-order creation + a non-guessable
-- confirmation token so /pedido/[id]/confirmacion cannot be scraped by UUID alone.
--
-- This is the migration as it was actually first applied to the INSUMOS
-- Supabase project (enjexsylblmzxnnlcurv). It has two known bugs, fixed by
-- the follow-up migration 20260831195354_insumos_checkout_fix_for_update_outer_join.sql:
--   1. `for update of pv` on a left-joined (nullable) table is illegal in
--      Postgres ("FOR UPDATE cannot be applied to the nullable side of an
--      outer join") — the existence check below never actually ran.
--   2. gen_random_bytes lives in the "extensions" schema on this project,
--      not "public", so the unqualified call below fails under this
--      function's restricted search_path.
-- Kept as originally applied, bugs included, so a fresh project replaying
-- both migrations in order ends up with the exact same schema history as
-- production rather than a rewritten one.

alter table public.orders
  add column if not exists confirmation_token text;

create unique index if not exists orders_confirmation_token_key
  on public.orders(confirmation_token) where confirmation_token is not null;

-- Revalidates and creates one pending order + its order_items atomically.
-- A PL/pgSQL function body runs inside the transaction of the calling
-- statement: any raised exception rolls back every insert made so far, so
-- there is no window where an order exists without its items (or vice versa).
--
-- Price, name, SKU and stock are always re-read here from product_variants /
-- products — the caller only supplies variant_id + quantity. Rows are locked
-- with `for update` while validating so a concurrent sale cannot oversell
-- between the stock check and the insert.
create or replace function public.create_pending_order(
  p_items jsonb,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_notes text
)
returns table (order_id uuid, confirmation_token text, subtotal integer, total integer)
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_token text;
  v_subtotal integer := 0;
  rec record;
  v_product_ids uuid[] := '{}';
  v_variant_ids uuid[] := '{}';
  v_product_names text[] := '{}';
  v_variant_names text[] := '{}';
  v_skus text[] := '{}';
  v_unit_prices integer[] := '{}';
  v_quantities integer[] := '{}';
  v_line_totals integer[] := '{}';
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.';
  end if;
  if coalesce(length(trim(p_customer_email)), 0) = 0 then
    raise exception 'El email es obligatorio.';
  end if;
  if coalesce(length(trim(p_customer_name)), 0) = 0 then
    raise exception 'El nombre es obligatorio.';
  end if;

  -- Duplicate variant_id entries (e.g. a client that failed to merge them)
  -- are summed here before any validation, so stock/min/max are checked
  -- against the true combined quantity rather than per fragment.
  for rec in
    select m.variant_id, m.quantity, pv.id as v_id, pv.product_id, pv.name as variant_name, pv.sku,
           pv.retail_price, pv.stock_quantity, pv.is_active, pv.min_quantity, pv.max_quantity,
           p.name as product_name, p.status as product_status
    from (
      select (item->>'variantId')::uuid as variant_id, sum((item->>'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) as item
      group by (item->>'variantId')::uuid
    ) m
    left join public.product_variants pv on pv.id = m.variant_id
    left join public.products p on p.id = pv.product_id
    order by m.variant_id
    for update of pv
  loop
    if rec.quantity is null or rec.quantity <= 0 then
      raise exception 'La cantidad debe ser un entero positivo.';
    end if;
    if rec.v_id is null or not rec.is_active then
      raise exception 'Esta variante ya no está disponible.';
    end if;
    if rec.product_status <> 'active' then
      raise exception 'Este producto ya no está disponible.';
    end if;
    if rec.quantity < rec.min_quantity then
      raise exception 'La cantidad mínima para % es %.', rec.product_name, rec.min_quantity;
    end if;
    if rec.max_quantity is not null and rec.quantity > rec.max_quantity then
      raise exception 'La cantidad máxima para % es %.', rec.product_name, rec.max_quantity;
    end if;
    if rec.quantity > rec.stock_quantity then
      raise exception 'El stock de % cambió. Hay % unidades disponibles.', rec.product_name, rec.stock_quantity;
    end if;

    v_product_ids := array_append(v_product_ids, rec.product_id);
    v_variant_ids := array_append(v_variant_ids, rec.variant_id);
    v_product_names := array_append(v_product_names, rec.product_name);
    v_variant_names := array_append(v_variant_names, rec.variant_name);
    v_skus := array_append(v_skus, rec.sku);
    v_unit_prices := array_append(v_unit_prices, rec.retail_price);
    v_quantities := array_append(v_quantities, rec.quantity);
    v_line_totals := array_append(v_line_totals, rec.retail_price * rec.quantity);
    v_subtotal := v_subtotal + (rec.retail_price * rec.quantity);
  end loop;

  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

  insert into public.orders (
    customer_id, customer_email, customer_name, customer_phone,
    status, payment_status, currency, subtotal, discount_total, shipping_total, total,
    shipping_address, notes, confirmation_token
  ) values (
    auth.uid(), trim(p_customer_email), trim(p_customer_name), nullif(trim(coalesce(p_customer_phone, '')), ''),
    'pending', 'pending', 'CLP', v_subtotal, 0, 0, v_subtotal,
    p_shipping_address, nullif(trim(coalesce(p_notes, '')), ''), v_token
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, quantity, discount_total, line_total
  )
  select v_order_id, t.product_id, t.variant_id, t.product_name, t.variant_name, t.sku, t.unit_price, t.quantity, 0, t.line_total
  from unnest(v_product_ids, v_variant_ids, v_product_names, v_variant_names, v_skus, v_unit_prices, v_quantities, v_line_totals)
    as t(product_id, variant_id, product_name, variant_name, sku, unit_price, quantity, line_total);

  return query select v_order_id, v_token, v_subtotal, v_subtotal;
end;
$$;

-- Guest checkout: no INSERT policy exists (or should exist) for orders/order_items
-- since customer_id is null for anonymous buyers and RLS has no identity to key
-- on. This SECURITY DEFINER function is the only sanctioned write path — it
-- re-validates everything itself rather than trusting the caller's role.
grant execute on function public.create_pending_order(jsonb, text, text, text, jsonb, text) to anon, authenticated;
