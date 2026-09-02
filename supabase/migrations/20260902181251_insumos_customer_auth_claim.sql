-- ArteInsumos — Perfil de Cliente Etapa 6B: capa DB para vincular
-- auth.users.id -> customers.user_id de forma explícita y controlada.
--
-- NO crea trigger sobre auth.users (decisión explícita de esta etapa).
-- La aplicación llamará claim_customer_for_current_user() explícitamente
-- después de que exista una sesión autenticada — funciona igual para
-- usuarios nuevos recién confirmados y para usuarios ya confirmados de
-- antes de que esta RPC existiera (no depende de un evento de trigger).
--
-- No agrega políticas RLS de comprador (Etapa 6C) ni toca
-- create_pending_order / checkout (Etapa 6G). Etapa 5 permanece intacta.

-- Garantiza como máximo un customer por auth.users.id. Parcial porque
-- user_id es nullable (todo customer de checkout de invitado tiene
-- user_id = NULL, y eso debe seguir siendo válido en cualquier cantidad).
create unique index if not exists customers_user_id_key
  on public.customers(user_id)
  where user_id is not null;

-- Sin parámetros de identidad: toda la identidad viene de auth.uid().
-- El cliente/navegador nunca puede pasar un email, customer_id o user_id
-- para que esta función los use como si fueran de confianza.
create or replace function public.claim_customer_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_email_normalized text;
  v_linked_customer_id uuid;
  v_linked_email text;
  v_customer_id uuid;
  v_result_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado.';
  end if;

  -- auth.users se consulta aquí adentro, con los privilegios del dueño de
  -- la función (SECURITY DEFINER) — nunca se acepta el email como argumento.
  select email, email_confirmed_at into v_email, v_email_confirmed_at
  from auth.users
  where id = v_user_id;

  if coalesce(length(trim(v_email)), 0) = 0 then
    raise exception 'No fue posible verificar tu correo.';
  end if;

  if v_email_confirmed_at is null then
    raise exception 'Debes confirmar tu correo antes de vincular tu cuenta.';
  end if;

  -- Misma semántica de normalización usada en el resto del proyecto
  -- (create_pending_order, backfill de Etapa 2): lower(trim(email)). No
  -- existe hoy un helper SQL reutilizable para esto — se mantiene inline
  -- para no introducir una segunda definición.
  v_email_normalized := lower(trim(v_email));

  -- Si este auth.uid() ya tiene un customer vinculado, la operación debe
  -- ser idempotente cuando coincide con el email actual, o rechazar sin
  -- fusionar/reasignar cuando no coincide (la cuenta ya pertenece a otro
  -- customer distinto del que correspondería al email de hoy).
  select id, email_normalized into v_linked_customer_id, v_linked_email
  from public.customers
  where user_id = v_user_id;

  if v_linked_customer_id is not null then
    if v_linked_email = v_email_normalized then
      return v_linked_customer_id;
    else
      raise exception 'Tu cuenta ya está vinculada a otro cliente.';
    end if;
  end if;

  -- ON CONFLICT (email_normalized) — no SELECT-then-INSERT — hace esto
  -- seguro ante dos llamadas concurrentes del mismo usuario: Postgres
  -- serializa los inserts contra el mismo valor de índice único, así que
  -- una sola inserta y la otra actualiza sobre la fila ya visible. Nunca
  -- se reasigna un user_id existente: el coalesce conserva el dueño
  -- original si la fila ya tenía uno (caso: pertenece a otra cuenta).
  insert into public.customers (email_normalized, user_id)
  values (v_email_normalized, v_user_id)
  on conflict (email_normalized) do update set
    user_id = coalesce(public.customers.user_id, excluded.user_id),
    updated_at = now()
  returning id, user_id into v_customer_id, v_result_user_id;

  if v_result_user_id is distinct from v_user_id then
    raise exception 'Este correo ya pertenece a otra cuenta.';
  end if;

  return v_customer_id;
end;
$$;

-- Anon no debe poder ni intentar ejecutar esto — se rechaza a nivel de
-- permisos de Postgres, antes de que corra una sola línea de la función.
-- Solo authenticated (una sesión real de Supabase Auth) puede invocarla.
revoke execute on function public.claim_customer_for_current_user() from public;
revoke execute on function public.claim_customer_for_current_user() from anon;
grant execute on function public.claim_customer_for_current_user() to authenticated;
