-- Mercado Pago Etapa 1, corrective fix: closes an inconsistency found while
-- testing the payment-preference-failure path. release_order_inventory
-- (insumos_inventory_reservations) deliberately never touches order.status —
-- by design, "releasing inventory" and "deciding the order's fate" are
-- separate responsibilities, so different callers (payment rejected, buyer
-- cancelled, payment-prep failed) can each apply their own outcome. But no
-- caller existed yet to supply that outcome for the "payment-prep failed"
-- case, so the checkout route's failure path left orders permanently stuck
-- at status='awaiting_payment' with zero active reservation — a state
-- expire_inventory_reservations can never reach, since its sweep only
-- touches rows with status='active'.
--
-- This migration adds ONE new, narrowly-scoped RPC for that exact case. It
-- does NOT modify release_order_inventory itself — that function, its
-- guarantees, and its existing tests are untouched, so any other future
-- caller (e.g. a "buyer cancelled" flow, which would want a DIFFERENT
-- outcome — status='cancelled', not 'pending' — and must not reuse this
-- function) keeps the exact behavior it already has today.
--
-- NOT APPLIED AUTOMATICALLY. Drafted for review. Filename/version is a
-- placeholder — like every migration before it in this feature, once
-- approved and applied the file will be renamed to match whatever version
-- Supabase actually assigns, so local history matches production exactly.

-- ==========================================================================
-- release_order_payment_reservation(order_id, confirmation_token, reason?)
-- ==========================================================================
-- Buyer-callable (same proof-of-possession model as reserve_order_inventory
-- / release_order_inventory: confirmation_token). Calls
-- release_order_inventory internally for the actual reservation release —
-- reusing it rather than duplicating its guard clauses (wrong token, order
-- already paid/fulfilled) or its release logic — then, ONLY when the order
-- is still 'awaiting_payment' with payment_status still 'pending', reverts
-- status back to 'pending'. payment_status itself is never touched here.
--
-- The condition is intentionally narrow (Section 5 of the spec this fixes):
--   order.status = 'awaiting_payment' AND payment_status = 'pending'
-- A paid/fulfilled/cancelled order is never touched (release_order_inventory
-- itself already refuses to run against paid/fulfilled orders, and a
-- cancelled order's payment_status is never 'pending' — see
-- expire_inventory_reservations, which always sets both together).
--
-- "No existe otra reserva active que justifique awaiting_payment" is
-- guaranteed structurally, not by an extra query: reserve_order_inventory
-- always creates every reservation row for an order in one batch sharing
-- one expires_at, and release_order_inventory releases ALL of an order's
-- active reservations in one statement — there is no schema state where
-- part of an order's reservation set stays active while another part is
-- released, so by the time this function's status check runs, zero active
-- reservations remain for the order regardless of how many variants it had.
--
-- Atomicity: a single RPC call is one implicit transaction. If
-- release_order_inventory raises (wrong token, order already paid), the
-- exception propagates out of this function too and nothing commits — there
-- is no window where the reservation is released but the status update was
-- skipped by an intermediate failure, and no window where the reverse could
-- happen either.
create or replace function public.release_order_payment_reservation(
  p_order_id uuid,
  p_confirmation_token text,
  p_reason text default null
)
returns table (released_count integer, order_status text, payment_status text)
language plpgsql security definer set search_path = public as $$
declare
  v_released_count integer;
  v_status text;
  v_payment_status text;
begin
  v_released_count := public.release_order_inventory(p_order_id, p_confirmation_token, p_reason);

  select o.status, o.payment_status into v_status, v_payment_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if v_status = 'awaiting_payment' and v_payment_status = 'pending' then
    update public.orders set status = 'pending' where id = p_order_id;
    v_status := 'pending';
  end if;

  return query select v_released_count, v_status, v_payment_status;
end;
$$;

grant execute on function public.release_order_payment_reservation(uuid, text, text) to anon, authenticated;
