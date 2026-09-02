-- ArteInsumos — Perfil de Cliente Etapa 2: esquema + backfill histórico + RLS.
--
-- Creates the customer master entity, decoupled from orders.customer_id
-- (which references profiles — the staff/admin auth profile, never
-- populated by guest checkout — and is left untouched here). Backfills
-- customers from the existing orders' email/name/phone snapshots and links
-- orders.buyer_id accordingly. Does NOT touch checkout, payments, webhook,
-- reservations, inventory, or orders.customer_id.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email_normalized text not null,
  phone_normalized text,
  rut_normalized text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The sole matching key. Deliberately not the primary key column itself —
-- id stays a surrogate uuid so nothing downstream ever has to treat an
-- email address as an identity that can't change.
create unique index customers_email_normalized_key on public.customers(email_normalized);

alter table public.orders add column buyer_id uuid references public.customers(id) on delete set null;

alter table public.customers enable row level security;

-- Same admin/staff-only pattern already used for orders — customers holds
-- PII, so there is no anon policy and no buyer-facing read policy yet
-- (buyers have no auth flow to be one of today). service_role bypasses RLS
-- entirely as usual and needs no explicit policy here.
create policy "catalog managers manage customers" on public.customers for all
  using (public.has_role('admin') or public.has_role('staff'))
  with check (public.has_role('admin') or public.has_role('staff'));

-- Reuses the exact same trigger function every other insumos table already
-- uses for updated_at — no new mechanism.
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();

-- Backfill: one customers row per distinct normalized email seen in
-- orders.customer_email (trim + lowercase, the same normalization
-- normalizeEmail() already applies client/server-side). created_at is the
-- first known purchase (MIN(orders.created_at)), not migration time.
-- full_name/phone_normalized are taken independently per field from the
-- most recent order that actually has a non-empty value for that field, so
-- a later order with a blank phone can never blank out an earlier known
-- one. rut_normalized is intentionally left null here — nothing in this
-- stage's scope asks for extracting it out of billing_data, and inventing
-- that extraction wasn't requested.
--
-- Idempotent: re-running recomputes the same aggregates from the current
-- set of orders and upserts by the unique email_normalized index — no
-- duplicate customers, and orders snapshot columns (customer_email,
-- customer_name, customer_phone, shipping_address, billing_data) are only
-- ever read here, never written.
insert into public.customers (email_normalized, full_name, phone_normalized, created_at)
select
  lower(trim(o.customer_email)) as email_normalized,
  (array_agg(o.customer_name order by o.created_at desc) filter (where coalesce(trim(o.customer_name), '') <> ''))[1] as full_name,
  (array_agg(o.customer_phone order by o.created_at desc) filter (where coalesce(trim(o.customer_phone), '') <> ''))[1] as phone_normalized,
  min(o.created_at) as created_at
from public.orders o
group by lower(trim(o.customer_email))
on conflict (email_normalized) do update set
  full_name = excluded.full_name,
  phone_normalized = excluded.phone_normalized,
  updated_at = now();

update public.orders o
set buyer_id = c.id
from public.customers c
where c.email_normalized = lower(trim(o.customer_email))
  and o.buyer_id is distinct from c.id;
