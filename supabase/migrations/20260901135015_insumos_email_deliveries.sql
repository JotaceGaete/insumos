-- Transactional email foundation: email_deliveries is audit/traceability
-- for outbound emails only — it is never the authority for order state,
-- and buyers never read it directly (no public policy, service-role only,
-- same pattern as inventory_reservations). No ZeptoMail connection, no
-- Mercado Pago, no cron, no retry workers, no pickup address — those stay
-- out of scope for this migration.

-- NOT APPLIED AUTOMATICALLY. Drafted for review. Filename/version is a
-- placeholder — like every migration before it in this feature, once
-- approved and applied the file will be renamed to match whatever version
-- Supabase actually assigns, so local history matches production exactly.

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  -- Nullable + ON DELETE SET NULL: this is a delivery record, not part of
  -- the order's own history — an order being removed should never cascade
  -- into deleting evidence of what was (or wasn't) emailed about it.
  order_id uuid references public.orders(id) on delete set null,
  event_type text not null,
  recipient text not null,
  provider text not null,
  provider_message_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotency backstop at the DB level: sendTransactionalEmail already
  -- checks for an existing row before inserting, but a concurrent duplicate
  -- request (double-click, refresh) still can't slip past this constraint.
  constraint email_deliveries_order_event_unique unique (order_id, event_type)
);

create index if not exists email_deliveries_order_id_idx on public.email_deliveries(order_id);

drop trigger if exists email_deliveries_set_updated_at on public.email_deliveries;
create trigger email_deliveries_set_updated_at before update on public.email_deliveries
  for each row execute function public.set_updated_at();

-- RLS enabled with zero policies: anon and authenticated get nothing at
-- all (recipient emails and provider error details are not for buyers to
-- read), while the service-role client sendTransactionalEmail actually
-- uses bypasses RLS entirely, same as inventory_reservations.
alter table public.email_deliveries enable row level security;
