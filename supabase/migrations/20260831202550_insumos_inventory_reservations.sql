-- Inventory reservations for ARTEMA checkout: order/payment states,
-- 15-minute holds on stock while a payment attempt is in flight, expiry,
-- explicit release, and a (still payment-provider-agnostic) conversion to a
-- real sale. Mercado Pago is NOT connected by this migration — confirm_order_paid
-- exists only as the future landing point for that webhook.
--
-- NOT APPLIED AUTOMATICALLY. Drafted for review. Filename/version is a
-- placeholder — like the checkout migration before it, once approved and
-- applied the file will be renamed to match whatever version Supabase
-- actually assigns, so local history matches production exactly.

-- ==========================================================================
-- 1. order.status / order.payment_status: lock the value sets down.
-- ==========================================================================
-- orders has 0 rows right now (test orders were cleaned up after the
-- checkout stage), so these are safe to add without a backfill.
alter table public.orders
  add constraint orders_status_allowed
  check (status in ('pending', 'awaiting_payment', 'paid', 'fulfilled', 'cancelled'));

alter table public.orders
  add constraint orders_payment_status_allowed
  check (payment_status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded'));

-- ==========================================================================
-- 2. inventory_reservations
-- ==========================================================================
do $$ begin
  create type public.reservation_status as enum ('active', 'released', 'converted', 'expired');
exception when duplicate_object then null; end $$;

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  converted_at timestamptz,
  -- Accepts release_order_inventory's optional reason (payment rejected,
  -- user cancelled, provider error) — not in the "minimum fields" list but
  -- directly needed to not silently discard that parameter.
  note text
);

create index if not exists inventory_reservations_order_id_idx
  on public.inventory_reservations(order_id);
create index if not exists inventory_reservations_variant_id_idx
  on public.inventory_reservations(variant_id);
-- Used by available_stock computation and by reserve_order_inventory's own
-- locking query: "active reservations for this variant, not yet expired".
create index if not exists inventory_reservations_active_variant_idx
  on public.inventory_reservations(variant_id) where status = 'active';
-- Used by expire_inventory_reservations' sweep.
create index if not exists inventory_reservations_active_expires_at_idx
  on public.inventory_reservations(expires_at) where status = 'active';

alter table public.inventory_reservations enable row level security;

-- No public/anon SELECT policy: reservation rows carry order_id and are
-- operationally internal. Buyers interact with reservations only through
-- the SECURITY DEFINER RPCs below (gated by confirmation_token), never by
-- querying this table directly — mirrors inventory_movements, which has
-- the same "staff-only read" shape.
create policy "catalog managers manage inventory reservations"
  on public.inventory_reservations for all
  using (public.has_role('admin') or public.has_role('staff'))
  with check (public.has_role('admin') or public.has_role('staff'));

-- ==========================================================================
-- 3. available_stock: physical stock minus other buyers' active, unexpired
-- holds. Safe to expose publicly — it's a derived number, not raw
-- reservation/order rows — the same trust level as stock_quantity already
-- has via the public "active variants" RLS policy.
-- ==========================================================================
create or replace view public.variant_available_stock as
select
  pv.id as variant_id,
  pv.stock_quantity,
  coalesce(r.reserved_quantity, 0) as reserved_quantity,
  pv.stock_quantity - coalesce(r.reserved_quantity, 0) as available_stock
from public.product_variants pv
left join (
  select variant_id, sum(quantity) as reserved_quantity
  from public.inventory_reservations
  where status = 'active' and expires_at > now()
  group by variant_id
) r on r.variant_id = pv.id;

grant select on public.variant_available_stock to anon, authenticated;

-- ==========================================================================
-- 4. reserve_order_inventory(order_id, confirmation_token)
-- ==========================================================================
-- Buyer-callable (proof of possession = confirmation_token, same model as
-- the order confirmation page). Locks every relevant variant row in a
-- deterministic order before validating, so a concurrent reservation on an
-- overlapping variant set serializes instead of racing — see report for the
-- full argument. All-or-nothing: any shortfall aborts before anything is
-- inserted, so there is no partial reservation.
create or replace function public.reserve_order_inventory(
  p_order_id uuid,
  p_confirmation_token text
)
returns table (reservation_id uuid, variant_id uuid, quantity integer, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_expires_at timestamptz;
  rec record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  -- Same generic message whether the order doesn't exist or the token is
  -- wrong — never confirms which one it was.
  if v_order.id is null or v_order.confirmation_token is null or v_order.confirmation_token <> p_confirmation_token then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_order.status in ('paid', 'fulfilled') then
    raise exception 'Este pedido ya fue pagado.';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'Este pedido fue cancelado.';
  end if;

  -- Idempotent: a still-active, unexpired reservation set already covers
  -- this order — reuse it. Deliberately does NOT extend expires_at, so a
  -- buyer retrying a stuck payment attempt can't keep stock locked
  -- indefinitely by re-hitting this endpoint.
  if exists (
    select 1 from public.inventory_reservations
    where order_id = p_order_id and status = 'active' and expires_at > now()
  ) then
    return query
      select r.id, r.variant_id, r.quantity, r.expires_at
      from public.inventory_reservations r
      where r.order_id = p_order_id and r.status = 'active' and r.expires_at > now()
      order by r.variant_id;
    return;
  end if;

  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'El pedido no tiene productos.';
  end if;

  v_expires_at := now() + interval '15 minutes';

  for rec in
    select oi.variant_id, oi.quantity, pv.is_active, p.status as product_status, p.name as product_name,
      pv.stock_quantity - coalesce((
        select sum(r.quantity) from public.inventory_reservations r
        where r.variant_id = pv.id and r.status = 'active' and r.expires_at > now()
      ), 0) as available_stock
    from public.order_items oi
    join public.product_variants pv on pv.id = oi.variant_id
    join public.products p on p.id = pv.product_id
    where oi.order_id = p_order_id
    order by oi.variant_id
    for update of pv
  loop
    if not rec.is_active or rec.product_status <> 'active' then
      raise exception 'Esta variante ya no está disponible.';
    end if;
    if rec.quantity > rec.available_stock then
      raise exception 'El stock de % cambió. Hay % unidades disponibles.', rec.product_name, rec.available_stock;
    end if;
  end loop;

  insert into public.inventory_reservations (order_id, variant_id, quantity, status, expires_at)
  select p_order_id, oi.variant_id, oi.quantity, 'active', v_expires_at
  from public.order_items oi
  where oi.order_id = p_order_id;

  update public.orders set status = 'awaiting_payment', payment_status = 'pending' where id = p_order_id;

  return query
    select r.id, r.variant_id, r.quantity, r.expires_at
    from public.inventory_reservations r
    where r.order_id = p_order_id and r.status = 'active'
    order by r.variant_id;
end;
$$;

grant execute on function public.reserve_order_inventory(uuid, text) to anon, authenticated;

-- ==========================================================================
-- 5. expire_inventory_reservations()
-- ==========================================================================
-- System sweep, no buyer proof-of-possession is possible (it processes
-- every due reservation, not one order) — restricted to service_role only,
-- see grants at the bottom. Never touches stock_quantity: a reservation
-- never decremented it. Idempotent: only ever acts on rows still 'active'
-- with expires_at <= now(), so re-running finds nothing left to do.
create or replace function public.expire_inventory_reservations()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_expired_count integer := 0;
  rec record;
begin
  for rec in
    select id, order_id from public.inventory_reservations
    where status = 'active' and expires_at <= now()
    for update
  loop
    update public.inventory_reservations set status = 'expired' where id = rec.id;
    v_expired_count := v_expired_count + 1;

    -- Never touches an order that already reached 'paid'/'fulfilled' — a
    -- reservation should never still be 'active' on a paid order (confirm_
    -- order_paid converts it), but this guard makes the sweep safe
    -- regardless of ordering.
    update public.orders
    set status = 'cancelled', payment_status = 'cancelled'
    where id = rec.order_id and status not in ('paid', 'fulfilled');
  end loop;
  return v_expired_count;
end;
$$;

-- ==========================================================================
-- 6. release_order_inventory(order_id, confirmation_token, reason?)
-- ==========================================================================
-- Releasing inventory and changing an order's state are DISTINCT
-- responsibilities, kept deliberately separate here: this function only
-- ever touches inventory_reservations (active -> released). It does NOT
-- decide the order's fate — order.status/payment_status are left exactly as
-- they were. A future "payment rejected" or "buyer cancelled" flow is
-- expected to call this AND THEN separately set order.status/payment_status
-- according to that flow's own rules (e.g. a rejected payment may leave the
-- order retryable; a user cancellation may not). Not implementing those
-- flows yet (no Mercado Pago), so nothing about order state is touched here
-- — expire_inventory_reservations is the one exception in this migration
-- that does both together, because expiry has only one possible outcome
-- (cancelled) and no caller-specific business rule to defer to.
create or replace function public.release_order_inventory(
  p_order_id uuid,
  p_confirmation_token text,
  p_reason text default null
)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_released_count integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.confirmation_token is null or v_order.confirmation_token <> p_confirmation_token then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_order.status in ('paid', 'fulfilled') then
    raise exception 'No es posible liberar un pedido ya pagado.';
  end if;

  update public.inventory_reservations
  set status = 'released', released_at = now(), note = coalesce(p_reason, note)
  where order_id = p_order_id and status = 'active';
  get diagnostics v_released_count = row_count;

  return v_released_count;
end;
$$;

grant execute on function public.release_order_inventory(uuid, text, text) to anon, authenticated;

-- ==========================================================================
-- 7. confirm_order_paid(order_id) — future webhook landing point, NOT
-- connected to any payment provider by this migration.
-- ==========================================================================
-- Idempotent: a second call for an already-'paid' order returns the current
-- state (already_confirmed = true) instead of erroring or re-applying
-- anything. Concurrency-safe via `select ... for update` on the order row:
-- two overlapping calls serialize, and the second always sees status =
-- 'paid' already once the first commits, so it always takes the idempotent
-- branch — no separate uniqueness constraint needed.
--
-- The reservation -> sale conversion decrements stock_quantity and writes
-- exactly one inventory_movements row per variant, once, here. The
-- reservation itself never touched stock_quantity, so there is no risk of
-- double-decrementing "reserve then sell" — only this step decrements at all.
create or replace function public.confirm_order_paid(
  p_order_id uuid
)
returns table (order_id uuid, status text, payment_status text, already_confirmed boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_item_count integer;
  v_reservation_count integer;
  rec record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Pedido no encontrado.';
  end if;

  if v_order.status = 'paid' then
    return query select v_order.id, v_order.status, v_order.payment_status, true;
    return;
  end if;

  if v_order.status in ('cancelled', 'fulfilled') then
    raise exception 'Este pedido no puede confirmarse en su estado actual.';
  end if;

  -- Cheap pre-check before taking any row locks: every order_item must have
  -- a still-active, unexpired reservation covering it. Not yet race-safe on
  -- its own (see the in-loop recheck below) — this just fails fast for the
  -- common case of no reservation at all.
  --
  select count(*) into v_item_count from public.order_items where order_id = p_order_id;
  select count(*) into v_reservation_count
    from public.inventory_reservations
    where order_id = p_order_id and status = 'active' and expires_at > now();
  if v_reservation_count <> v_item_count then
    raise exception 'La reserva de este pedido venció o no existe. No se pudo confirmar el pago.';
  end if;

  for rec in
    select r.id as reservation_id, r.variant_id, r.quantity, r.status as reservation_status,
           r.expires_at as reservation_expires_at, pv.stock_quantity
    from public.inventory_reservations r
    join public.product_variants pv on pv.id = r.variant_id
    where r.order_id = p_order_id and r.status = 'active'
    order by r.variant_id
    for update of r, pv
  loop
    -- The count check above ran before any lock was held, so a concurrent
    -- expire_inventory_reservations sweep could have expired this exact
    -- reservation in the gap between that check and this lock. Locking `r`
    -- (not just `pv`) forces this transaction to wait for that sweep if it
    -- was already in flight, then see its real outcome here — this recheck,
    -- under lock, is the actual race-safe authority, not the count above.
    if rec.reservation_status <> 'active' or rec.reservation_expires_at <= now() then
      raise exception 'La reserva de este pedido venció o no existe. No se pudo confirmar el pago.';
    end if;
    if rec.quantity > rec.stock_quantity then
      -- Should be unreachable — the reservation already guaranteed this
      -- quantity was available — but stock is re-checked rather than
      -- assumed immediately before it is ever decremented.
      raise exception 'Inconsistencia de stock detectada al confirmar el pedido.';
    end if;

    update public.product_variants set stock_quantity = stock_quantity - rec.quantity where id = rec.variant_id;

    insert into public.inventory_movements (
      variant_id, movement_type, quantity_delta, balance_after, reference_type, reference_id, note, created_by
    ) values (
      rec.variant_id, 'sale', -rec.quantity, rec.stock_quantity - rec.quantity, 'order', p_order_id, 'Venta confirmada', null
    );

    update public.inventory_reservations set status = 'converted', converted_at = now() where id = rec.reservation_id;
  end loop;

  update public.orders set status = 'paid', payment_status = 'approved' where id = p_order_id;

  return query select p_order_id, 'paid'::text, 'approved'::text, false;
end;
$$;

-- Every new function defaults to EXECUTE granted to PUBLIC (which anon and
-- authenticated inherit) unless revoked — confirm_order_paid must NOT be
-- callable by anon/authenticated at all, only by a future server-side
-- webhook handler using the service-role client. Explicit revoke, then a
-- narrow grant to service_role only.
revoke all on function public.confirm_order_paid(uuid) from public;
revoke all on function public.confirm_order_paid(uuid) from anon;
revoke all on function public.confirm_order_paid(uuid) from authenticated;
grant execute on function public.confirm_order_paid(uuid) to service_role;

-- Same treatment for the sweep — no buyer proof-of-possession applies to a
-- function with no order_id argument, so it must never be anon/authenticated
-- callable either.
revoke all on function public.expire_inventory_reservations() from public;
revoke all on function public.expire_inventory_reservations() from anon;
revoke all on function public.expire_inventory_reservations() from authenticated;
grant execute on function public.expire_inventory_reservations() to service_role;

-- ==========================================================================
-- 8. create_pending_order now validates available_stock, not raw
-- stock_quantity — creating a pending order still does NOT reserve
-- anything; it only refuses to create an order for stock that's already
-- fully spoken for by other buyers' active reservations.
-- ==========================================================================
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
