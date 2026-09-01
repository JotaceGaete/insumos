-- Checkout V2.1: stricter buyer-input validation (full name, email, Chilean
-- mobile phone), an optional villa/población/sector field on the shipping
-- snapshot, and a new "Retiro en tienda" delivery method alongside shipping.
-- No Mercado Pago, no webhooks, no payment ids, no transport-carrier APIs,
-- no cron, no electronic invoicing, no emails, no tracking — those stay out
-- of scope for this migration, same as V2.

-- NOT APPLIED AUTOMATICALLY. Drafted for review. Filename/version is a
-- placeholder — like every migration before it in this feature, once
-- approved and applied the file will be renamed to match whatever version
-- Supabase actually assigns, so local history matches production exactly.

-- ==========================================================================
-- 1. is_valid_full_name / is_valid_email / is_valid_cl_mobile — mirror the
-- TS validators in src/features/checkout/{name,email,phone}.ts exactly, so
-- a direct RPC call can't create an order with a garbage name, a malformed
-- email, or a non-Chilean-mobile phone even if it skips the app layer.
-- ==========================================================================

-- Same "accented Latin-1 letters" trick as the TS regex: À-ÖØ-öø-ÿ walks the
-- codepoint block but skips × (00D7) and ÷ (00F7) by construction, so this
-- covers á é í ó ú ü ñ Ñ Á É Í Ó Ú Ü etc. without depending on server
-- locale/collation the way a POSIX [[:alpha:]] class would.
create or replace function public.is_valid_full_name(p_name text)
returns boolean
language sql immutable as $$
  select p_name ~ '^[A-Za-zÀ-ÖØ-öø-ÿ]([A-Za-zÀ-ÖØ-öø-ÿ ''-]*[A-Za-zÀ-ÖØ-öø-ÿ])?$'
    and length(p_name) between 2 and 120;
$$;

create or replace function public.is_valid_email(p_email text)
returns boolean
language sql immutable as $$
  select p_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$';
$$;

-- Chilean mobile only: "+56" followed by exactly 9 digits starting with 9.
create or replace function public.is_valid_cl_mobile(p_phone text)
returns boolean
language sql immutable as $$
  select p_phone ~ '^\+569[0-9]{8}$';
$$;

-- ==========================================================================
-- 2. orders: delivery_method, and shipping_policy gains 'pickup'
-- ==========================================================================
alter table public.orders
  add column if not exists delivery_method text not null default 'shipping'
    check (delivery_method in ('shipping', 'store_pickup'));

alter table public.orders drop constraint if exists orders_shipping_policy_check;
alter table public.orders
  add constraint orders_shipping_policy_check
  check (shipping_policy in ('free', 'receiver_pays', 'pickup'));

-- Ties delivery_method to shipping_policy and preferred_carrier so the pair
-- can never drift apart at the row level, on top of what the RPC already
-- enforces: a pickup order can't carry a shipping-flavored policy or a
-- carrier preference, and a shipping order can't be missing either.
alter table public.orders
  add constraint orders_delivery_shipping_coherence
  check (
    (delivery_method = 'store_pickup' and shipping_policy = 'pickup' and preferred_carrier is null)
    or (delivery_method = 'shipping' and shipping_policy in ('free', 'receiver_pays') and preferred_carrier is not null)
  );

-- shipping_address keeps its existing jsonb shape (region, comuna, address,
-- number, unit) plus a new optional "sector" key for villa/población/sector
-- — documented here rather than as a real column, same reasoning as
-- billing_data: it's a per-order snapshot, not a reusable customer profile
-- field, and the column is already schemaless jsonb. For store_pickup
-- orders shipping_address is null (there is no despacho address).

-- ==========================================================================
-- 3. create_pending_order — adds p_delivery_method, validates name/email/
-- phone server-side, and branches shipping-address/carrier requirements on
-- delivery method. Item/price/stock revalidation is unchanged from V2.
-- ==========================================================================
drop function if exists public.create_pending_order(jsonb, text, text, text, jsonb, text, text, text, jsonb);

create or replace function public.create_pending_order(
  p_items jsonb,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_notes text,
  p_preferred_carrier text,
  p_billing_document_type text default 'boleta',
  p_billing_data jsonb default null,
  p_delivery_method text default 'shipping'
)
returns table (order_id uuid, confirmation_token text, subtotal integer, total integer, shipping_policy text)
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_token text;
  v_subtotal integer := 0;
  v_merged_count integer;
  v_matched_count integer := 0;
  v_shipping_policy text;
  v_billing_document_type text;
  v_delivery_method text;
  v_shipping_address jsonb;
  v_preferred_carrier text;
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
  if not public.is_valid_full_name(trim(p_customer_name)) then
    raise exception 'Ingresa un nombre válido.';
  end if;
  if not public.is_valid_email(trim(p_customer_email)) then
    raise exception 'Ingresa un correo electrónico válido.';
  end if;
  if not public.is_valid_cl_mobile(trim(coalesce(p_customer_phone, ''))) then
    raise exception 'Ingresa un celular chileno válido.';
  end if;

  v_delivery_method := coalesce(p_delivery_method, 'shipping');
  if v_delivery_method not in ('shipping', 'store_pickup') then
    raise exception 'Selecciona una forma de entrega válida.';
  end if;

  if v_delivery_method = 'shipping' then
    -- Shipping address: region + comuna must be a real, matching pair —
    -- validated against the same Chile geography table the checkout UI's
    -- cascading selects are seeded from, never trusted as free text.
    if p_shipping_address is null
       or not exists (
         select 1 from public.cl_comunas
         where comuna = (p_shipping_address->>'comuna')
           and region = (p_shipping_address->>'region')
       )
    then
      raise exception 'La región o comuna de despacho no es válida.';
    end if;

    -- A user preference, but still constrained to a fixed allowlist — never
    -- an arbitrary client-supplied string.
    if p_preferred_carrier is null or p_preferred_carrier not in ('starken', 'chilexpress', 'blue_express') then
      raise exception 'Selecciona un transportista válido.';
    end if;

    v_shipping_address := p_shipping_address;
    v_preferred_carrier := p_preferred_carrier;
  else
    -- store_pickup: there is no despacho, so neither field has any
    -- authority here — whatever the client sent for them is discarded
    -- rather than validated, exactly like the client-side validator does.
    v_shipping_address := null;
    v_preferred_carrier := null;
  end if;

  v_billing_document_type := coalesce(p_billing_document_type, 'boleta');
  if v_billing_document_type not in ('boleta', 'factura') then
    raise exception 'Selecciona un documento tributario válido.';
  end if;

  if v_billing_document_type = 'factura' then
    if p_billing_data is null
       or coalesce(length(trim(p_billing_data->>'rut')), 0) = 0
       or not public.is_valid_rut(p_billing_data->>'rut')
       or coalesce(length(trim(p_billing_data->>'businessName')), 0) = 0
       or coalesce(length(trim(p_billing_data->>'businessActivity')), 0) = 0
       or coalesce(length(trim(p_billing_data->>'email')), 0) = 0
       or coalesce(length(trim(p_billing_data->>'address')), 0) = 0
       or coalesce(length(trim(p_billing_data->>'number')), 0) = 0
       or not exists (
         select 1 from public.cl_comunas
         where comuna = (p_billing_data->>'comuna')
           and region = (p_billing_data->>'region')
       )
    then
      raise exception 'Los datos de facturación son incompletos o inválidos.';
    end if;
  end if;

  select count(*) into v_merged_count from (
    select distinct (item->>'variantId')::uuid as variant_id
    from jsonb_array_elements(p_items) as item
  ) d;

  for rec in
    select m.variant_id, m.quantity, pv.id as v_id, pv.product_id, pv.name as variant_name, pv.sku,
           pv.retail_price, pv.is_active, pv.min_quantity, pv.max_quantity,
           p.name as product_name, p.status as product_status,
           pv.stock_quantity - coalesce((
             select sum(r.quantity) from public.inventory_reservations r
             where r.variant_id = pv.id and r.status = 'active' and r.expires_at > now()
           ), 0) as available_stock
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
    if rec.quantity > rec.available_stock then
      raise exception 'El stock de % cambió. Hay % unidades disponibles.', rec.product_name, rec.available_stock;
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

  if v_matched_count < v_merged_count then
    raise exception 'Esta variante ya no está disponible.';
  end if;

  -- shipping_policy is derived from delivery_method + the server-computed
  -- subtotal only — the client never sends this value at all, so there's
  -- nothing to ignore even if a manipulated request tried to include one.
  v_shipping_policy := case
    when v_delivery_method = 'store_pickup' then 'pickup'
    when v_subtotal >= 50000 then 'free'
    else 'receiver_pays'
  end;

  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  insert into public.orders (
    customer_id, customer_email, customer_name, customer_phone,
    status, payment_status, currency, subtotal, discount_total, shipping_total, total,
    shipping_address, notes, confirmation_token,
    delivery_method, shipping_policy, preferred_carrier, billing_document_type, billing_data
  ) values (
    auth.uid(), trim(p_customer_email), trim(p_customer_name), nullif(trim(coalesce(p_customer_phone, '')), ''),
    'pending', 'pending', 'CLP', v_subtotal, 0, 0, v_subtotal,
    v_shipping_address, nullif(trim(coalesce(p_notes, '')), ''), v_token,
    v_delivery_method, v_shipping_policy, v_preferred_carrier, v_billing_document_type,
    case when v_billing_document_type = 'factura' then p_billing_data else null end
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, quantity, discount_total, line_total
  )
  select v_order_id, t.product_id, t.variant_id, t.product_name, t.variant_name, t.sku, t.unit_price, t.quantity, 0, t.line_total
  from unnest(v_product_ids, v_variant_ids, v_product_names, v_variant_names, v_skus, v_unit_prices, v_quantities, v_line_totals)
    as t(product_id, variant_id, product_name, variant_name, sku, unit_price, quantity, line_total);

  return query select v_order_id, v_token, v_subtotal, v_subtotal, v_shipping_policy;
end;
$$;

grant execute on function public.create_pending_order(jsonb, text, text, text, jsonb, text, text, text, jsonb, text) to anon, authenticated;
