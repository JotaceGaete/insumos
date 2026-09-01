-- Mercado Pago Etapa 2A: atomic wrapper that records the authoritative
-- payment id (orders.payment_reference) and confirms the order in a single
-- transaction. confirm_order_paid itself is NOT modified — it already has
-- everything Etapa 2A needs (idempotent on order.status='paid', row-locked,
-- refuses expired reservations without compensating, converts reservations
-- and writes exactly one inventory_movements row per variant). This
-- migration only adds the missing piece: nothing before this connected a
-- specific payment id to an order before calling confirm_order_paid, which
-- is exactly the gap that could have left payment_reference persisted while
-- confirmation failed (or vice versa) if done as two separate calls from
-- application code.
--
-- NOT APPLIED AUTOMATICALLY. Drafted for review. Filename/version is a
-- placeholder — like every migration before it in this feature, once
-- approved and applied the file will be renamed to match whatever version
-- Supabase actually assigns, so local history matches production exactly.

-- ==========================================================================
-- confirm_order_payment_reference(order_id, payment_reference)
-- ==========================================================================
-- service_role-only (same as confirm_order_paid): this is called exclusively
-- from the webhook route after a payment has already been fetched and
-- validated server-side against the real Mercado Pago API — the browser
-- never reaches this function directly, by the same reasoning
-- confirm_order_paid was already locked down to service_role.
--
-- Atomicity: a single RPC call is one implicit Postgres transaction. Locking
-- the order row first (for update) means a concurrent call for the same
-- order_id serializes behind this one rather than racing it — the second
-- call only proceeds once the first has committed (or rolled back), and by
-- then order.status already reflects the outcome. If confirm_order_paid
-- raises (expired reservation, stock inconsistency, order already
-- cancelled/fulfilled), the exception propagates out of this function too,
-- so the payment_reference UPDATE below it in program order never commits —
-- there is no window where payment_reference is saved but confirmation
-- failed, or the reverse.
--
-- Idempotency: if the order is already 'paid':
--   - same payment_reference as already stored -> treated as a duplicate
--     webhook delivery, returns the current (already-confirmed) state
--     without writing anything.
--   - a DIFFERENT payment_reference than already stored -> this is
--     anomalous (two different Mercado Pago payments both claiming to have
--     paid the same order) and is surfaced as an explicit exception rather
--     than silently overwritten or ignored.
--
-- Cross-order protection: orders.payment_reference already carries a UNIQUE
-- constraint (insumos_foundation). If some other order already claims this
-- exact payment_reference, the UPDATE below violates that constraint and
-- the whole call fails loudly — a payment id can never end up confirming
-- two different orders, and the database is the actual backstop for that
-- guarantee, not application-level logic.
create or replace function public.confirm_order_payment_reference(
  p_order_id uuid,
  p_payment_reference text
)
returns table (order_id uuid, status text, payment_status text, payment_reference text, already_confirmed boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_confirm record;
begin
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'payment_reference es obligatorio.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Pedido no encontrado.';
  end if;

  if v_order.status = 'paid' then
    if v_order.payment_reference = p_payment_reference then
      return query select v_order.id, v_order.status, v_order.payment_status, v_order.payment_reference, true;
      return;
    end if;
    raise exception 'Este pedido ya fue confirmado con un payment_reference distinto.';
  end if;

  update public.orders set payment_reference = p_payment_reference where id = p_order_id;

  select * into v_confirm from public.confirm_order_paid(p_order_id);

  return query select v_confirm.order_id, v_confirm.status, v_confirm.payment_status, p_payment_reference, v_confirm.already_confirmed;
end;
$$;

revoke all on function public.confirm_order_payment_reference(uuid, text) from public;
revoke all on function public.confirm_order_payment_reference(uuid, text) from anon;
revoke all on function public.confirm_order_payment_reference(uuid, text) from authenticated;
grant execute on function public.confirm_order_payment_reference(uuid, text) to service_role;
