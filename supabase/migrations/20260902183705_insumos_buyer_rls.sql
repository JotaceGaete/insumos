-- ArteInsumos — Perfil de Cliente Etapa 6C: RLS de comprador.
--
-- Agrega políticas SELECT aditivas para que un comprador autenticado (con
-- customers.user_id = auth.uid(), ya vinculado vía claim_customer_for_
-- current_user() de Etapa 6B) pueda leer exclusivamente su propia fila de
-- customers, sus propios orders (vía buyer_id) y sus propios order_items
-- (vía orders.buyer_id). La autorización nunca se basa en email — siempre
-- en auth.uid() encadenado a través de customers.user_id.
--
-- Puramente aditivo: ninguna política existente (admin/staff, ni la
-- legacy "customers read own orders"/"customers read own order items"
-- basada en orders.customer_id = auth.uid()) se modifica ni se elimina.
-- Postgres combina múltiples políticas PERMISSIVE del mismo comando con
-- OR, así que agregar estas no puede restringir accesos ya permitidos.
--
-- Sin INSERT/UPDATE/DELETE para comprador — esas operaciones siguen
-- exclusivamente a cargo de admin/staff o de RPCs SECURITY DEFINER
-- (create_pending_order, claim_customer_for_current_user). No se tocan
-- grants de tabla: authenticated ya tiene SELECT a nivel de tabla (grant
-- por defecto de Supabase); RLS es la única capa que decide qué filas.

create policy "buyers read own customer row" on public.customers
  for select using (user_id = auth.uid());

create policy "buyers read own orders" on public.orders
  for select using (
    exists (
      select 1 from public.customers c
      where c.id = orders.buyer_id and c.user_id = auth.uid()
    )
  );

create policy "buyers read own order items" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.buyer_id
      where o.id = order_items.order_id and c.user_id = auth.uid()
    )
  );
