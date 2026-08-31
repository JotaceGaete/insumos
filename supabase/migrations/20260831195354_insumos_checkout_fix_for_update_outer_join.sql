-- Fixes create_pending_order (20260831194938_insumos_checkout_orders):
-- Postgres rejects `for update` on the nullable side of an outer join, so
-- the original left join + "v_id is null" existence check could never run.
-- Switched to an inner join and detect a missing variant by comparing the
-- merged item count against how many rows the loop actually matched.
--
-- Also schema-qualifies gen_random_bytes as extensions.gen_random_bytes:
-- pgcrypto lives in the "extensions" schema on this project, not "public",
-- and this function's search_path is deliberately restricted to public only.

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
  v_merged_count integer;
  v_matched_count integer := 0;
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

  select count(*) into v_merged_count from (
    select distinct (item->>'variantId')::uuid as variant_id
    from jsonb_array_elements(p_items) as item
  ) d;

  -- This must be an inner join: Postgres rejects `for update` on the
  -- nullable side of an outer join outright ("FOR UPDATE cannot be applied
  -- to the nullable side of an outer join"), so a missing variant can't be
  -- detected via a left join producing a null row here. Instead the merged
  -- item count above is compared against how many rows this loop actually
  -- matched, right after it.
  for rec in
    select m.variant_id, m.quantity, pv.id as v_id, pv.product_id, pv.name as variant_name, pv.sku,
           pv.retail_price, pv.stock_quantity, pv.is_active, pv.min_quantity, pv.max_quantity,
           p.name as product_name, p.status as product_status
    from (
      select (item->>'variantId')::uuid as variant_id, sum((item->>'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) as item
      group by (item->>'variantId')::uuid
    ) m
    join public.product_variants pv on pv.id = m.variant_id
    join public.products p on p.id = pv.product_id
    order by m.variant_id
    for update of pv
  loop
    v_matched_count := v_matched_count + 1;
    if rec.quantity is null or rec.quantity <= 0 then
      raise exception 'La cantidad debe ser un entero positivo.';
    end if;
    if not rec.is_active then
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

  -- The inner join above silently drops any variant_id that doesn't exist —
  -- fewer matched rows than distinct requested variants means at least one
  -- of them isn't real.
  if v_matched_count < v_merged_count then
    raise exception 'Esta variante ya no está disponible.';
  end if;

  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

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
