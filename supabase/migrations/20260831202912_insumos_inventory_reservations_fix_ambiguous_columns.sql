-- Fixes reserve_order_inventory and confirm_order_paid
-- (20260831202550_insumos_inventory_reservations): both declare RETURNS
-- TABLE columns that collide by name with real table columns referenced
-- bare inside the function body (expires_at in reserve_order_inventory;
-- order_id and status in confirm_order_paid). PL/pgSQL treats RETURNS
-- TABLE columns as implicitly-declared variables in scope through the
-- whole function body, so those bare references were genuinely ambiguous
-- and made both functions fail on every call. Fixed by table-qualifying
-- every such reference.

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
  if v_order.id is null or v_order.confirmation_token is null or v_order.confirmation_token <> p_confirmation_token then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_order.status in ('paid', 'fulfilled') then
    raise exception 'Este pedido ya fue pagado.';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'Este pedido fue cancelado.';
  end if;

  -- `expires_at` is also this function's own OUT column name (from
  -- `returns table (...)`), and PL/pgSQL treats OUT columns as implicitly-
  -- declared variables in scope through the whole body — a bare
  -- `expires_at` is genuinely ambiguous between that variable and the
  -- inventory_reservations column, hence the `ir` alias below.
  if exists (
    select 1 from public.inventory_reservations ir
    where ir.order_id = p_order_id and ir.status = 'active' and ir.expires_at > now()
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

  -- This function's own OUT columns (order_id, status, ...) are implicitly
  -- in scope as variables for the whole body, so bare `order_id`/`status`
  -- below would be genuinely ambiguous against order_items.order_id /
  -- inventory_reservations.status rather than ever referring to a table —
  -- hence the `oi`/`ir` aliases.
  select count(*) into v_item_count from public.order_items oi where oi.order_id = p_order_id;
  select count(*) into v_reservation_count
    from public.inventory_reservations ir
    where ir.order_id = p_order_id and ir.status = 'active' and ir.expires_at > now();
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
    if rec.reservation_status <> 'active' or rec.reservation_expires_at <= now() then
      raise exception 'La reserva de este pedido venció o no existe. No se pudo confirmar el pago.';
    end if;
    if rec.quantity > rec.stock_quantity then
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
