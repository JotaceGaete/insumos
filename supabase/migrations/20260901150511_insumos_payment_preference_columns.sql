-- Mercado Pago Etapa 1: minimal columns to persist a created payment
-- preference for correlation and idempotent reuse. payment_provider and
-- payment_reference already exist (insumos_foundation) — payment_reference
-- is left untouched here, reserved for the actual payment id a future
-- webhook (Etapa 2) will write; reusing it for the pre-payment preference
-- id would collide with that later, unrelated concept.
--
-- NOT APPLIED AUTOMATICALLY. Drafted for review. Filename/version is a
-- placeholder — like every migration before it in this feature, once
-- approved and applied the file will be renamed to match whatever version
-- Supabase actually assigns, so local history matches production exactly.

alter table public.orders
  add column payment_provider_preference_id text unique,
  add column payment_checkout_url text,
  add column payment_created_at timestamptz;
