-- Checkout V2: free-shipping threshold policy, carrier preference, boleta/
-- factura with billing data, and a local Chile region/comuna lookup table
-- used both to validate the shipping address and (mirrored into billing
-- data) the invoice address. No Mercado Pago, no webhooks, no payment ids,
-- no transport-carrier APIs, no cron, no electronic invoicing — those stay
-- out of scope for this migration.
--
-- NOT APPLIED AUTOMATICALLY. Drafted for review. Filename/version is a
-- placeholder — like every migration before it in this feature, once
-- approved and applied the file will be renamed to match whatever version
-- Supabase actually assigns, so local history matches production exactly.

-- ==========================================================================
-- 1. cl_comunas — local, versioned Chile region/comuna dataset (346 comunas,
-- 16 regions), the same data the checkout UI's cascading selects are built
-- from (src/features/checkout/regionComuna.ts). comuna is the primary key
-- because comuna names are unique nationally in this dataset — that also
-- means "a comuna belongs to exactly one region" is enforced structurally,
-- not just by convention.
-- ==========================================================================
create table if not exists public.cl_comunas (
  comuna text primary key,
  region text not null
);

create index if not exists cl_comunas_region_idx on public.cl_comunas(region);

insert into public.cl_comunas (comuna, region) values
  ('Arica', 'Región de Arica y Parinacota'),
  ('Camarones', 'Región de Arica y Parinacota'),
  ('General Lagos', 'Región de Arica y Parinacota'),
  ('Putre', 'Región de Arica y Parinacota'),
  ('Iquique', 'Región de Tarapacá'),
  ('Alto Hospicio', 'Región de Tarapacá'),
  ('Pozo Almonte', 'Región de Tarapacá'),
  ('Camiña', 'Región de Tarapacá'),
  ('Colchane', 'Región de Tarapacá'),
  ('Huara', 'Región de Tarapacá'),
  ('Pica', 'Región de Tarapacá'),
  ('Antofagasta', 'Región de Antofagasta'),
  ('Mejillones', 'Región de Antofagasta'),
  ('Sierra Gorda', 'Región de Antofagasta'),
  ('Taltal', 'Región de Antofagasta'),
  ('Calama', 'Región de Antofagasta'),
  ('Ollagüe', 'Región de Antofagasta'),
  ('San Pedro de Atacama', 'Región de Antofagasta'),
  ('Tocopilla', 'Región de Antofagasta'),
  ('María Elena', 'Región de Antofagasta'),
  ('Copiapó', 'Región de Atacama'),
  ('Caldera', 'Región de Atacama'),
  ('Tierra Amarilla', 'Región de Atacama'),
  ('Chañaral', 'Región de Atacama'),
  ('Diego de Almagro', 'Región de Atacama'),
  ('Vallenar', 'Región de Atacama'),
  ('Alto del Carmen', 'Región de Atacama'),
  ('Freirina', 'Región de Atacama'),
  ('Huasco', 'Región de Atacama'),
  ('La Serena', 'Región de Coquimbo'),
  ('Coquimbo', 'Región de Coquimbo'),
  ('Andacollo', 'Región de Coquimbo'),
  ('La Higuera', 'Región de Coquimbo'),
  ('Paiguano', 'Región de Coquimbo'),
  ('Vicuña', 'Región de Coquimbo'),
  ('Illapel', 'Región de Coquimbo'),
  ('Canela', 'Región de Coquimbo'),
  ('Los Vilos', 'Región de Coquimbo'),
  ('Salamanca', 'Región de Coquimbo'),
  ('Ovalle', 'Región de Coquimbo'),
  ('Combarbalá', 'Región de Coquimbo'),
  ('Monte Patria', 'Región de Coquimbo'),
  ('Punitaqui', 'Región de Coquimbo'),
  ('Río Hurtado', 'Región de Coquimbo'),
  ('Valparaíso', 'Región de Valparaíso'),
  ('Casablanca', 'Región de Valparaíso'),
  ('Concón', 'Región de Valparaíso'),
  ('Juan Fernández', 'Región de Valparaíso'),
  ('Puchuncaví', 'Región de Valparaíso'),
  ('Quintero', 'Región de Valparaíso'),
  ('Viña del Mar', 'Región de Valparaíso'),
  ('Isla de Pascua', 'Región de Valparaíso'),
  ('Los Andes', 'Región de Valparaíso'),
  ('Calle Larga', 'Región de Valparaíso'),
  ('Rinconada', 'Región de Valparaíso'),
  ('San Esteban', 'Región de Valparaíso'),
  ('La Ligua', 'Región de Valparaíso'),
  ('Cabildo', 'Región de Valparaíso'),
  ('Papudo', 'Región de Valparaíso'),
  ('Petorca', 'Región de Valparaíso'),
  ('Zapallar', 'Región de Valparaíso'),
  ('Quillota', 'Región de Valparaíso'),
  ('La Calera', 'Región de Valparaíso'),
  ('Hijuelas', 'Región de Valparaíso'),
  ('La Cruz', 'Región de Valparaíso'),
  ('Nogales', 'Región de Valparaíso'),
  ('San Antonio', 'Región de Valparaíso'),
  ('Algarrobo', 'Región de Valparaíso'),
  ('Cartagena', 'Región de Valparaíso'),
  ('El Quisco', 'Región de Valparaíso'),
  ('El Tabo', 'Región de Valparaíso'),
  ('Santo Domingo', 'Región de Valparaíso'),
  ('San Felipe', 'Región de Valparaíso'),
  ('Catemu', 'Región de Valparaíso'),
  ('Llaillay', 'Región de Valparaíso'),
  ('Panquehue', 'Región de Valparaíso'),
  ('Putaendo', 'Región de Valparaíso'),
  ('Santa María', 'Región de Valparaíso'),
  ('Quilpué', 'Región de Valparaíso'),
  ('Limache', 'Región de Valparaíso'),
  ('Olmué', 'Región de Valparaíso'),
  ('Villa Alemana', 'Región de Valparaíso'),
  ('Santiago', 'Región Metropolitana de Santiago'),
  ('Cerrillos', 'Región Metropolitana de Santiago'),
  ('Cerro Navia', 'Región Metropolitana de Santiago'),
  ('Conchalí', 'Región Metropolitana de Santiago'),
  ('El Bosque', 'Región Metropolitana de Santiago'),
  ('Estación Central', 'Región Metropolitana de Santiago'),
  ('Huechuraba', 'Región Metropolitana de Santiago'),
  ('Independencia', 'Región Metropolitana de Santiago'),
  ('La Cisterna', 'Región Metropolitana de Santiago'),
  ('La Florida', 'Región Metropolitana de Santiago'),
  ('La Granja', 'Región Metropolitana de Santiago'),
  ('La Pintana', 'Región Metropolitana de Santiago'),
  ('La Reina', 'Región Metropolitana de Santiago'),
  ('Las Condes', 'Región Metropolitana de Santiago'),
  ('Lo Barnechea', 'Región Metropolitana de Santiago'),
  ('Lo Espejo', 'Región Metropolitana de Santiago'),
  ('Lo Prado', 'Región Metropolitana de Santiago'),
  ('Macul', 'Región Metropolitana de Santiago'),
  ('Maipú', 'Región Metropolitana de Santiago'),
  ('Ñuñoa', 'Región Metropolitana de Santiago'),
  ('Pedro Aguirre Cerda', 'Región Metropolitana de Santiago'),
  ('Peñalolén', 'Región Metropolitana de Santiago'),
  ('Providencia', 'Región Metropolitana de Santiago'),
  ('Pudahuel', 'Región Metropolitana de Santiago'),
  ('Quilicura', 'Región Metropolitana de Santiago'),
  ('Quinta Normal', 'Región Metropolitana de Santiago'),
  ('Recoleta', 'Región Metropolitana de Santiago'),
  ('Renca', 'Región Metropolitana de Santiago'),
  ('San Joaquín', 'Región Metropolitana de Santiago'),
  ('San Miguel', 'Región Metropolitana de Santiago'),
  ('San Ramón', 'Región Metropolitana de Santiago'),
  ('Vitacura', 'Región Metropolitana de Santiago'),
  ('Puente Alto', 'Región Metropolitana de Santiago'),
  ('Pirque', 'Región Metropolitana de Santiago'),
  ('San José de Maipo', 'Región Metropolitana de Santiago'),
  ('Colina', 'Región Metropolitana de Santiago'),
  ('Lampa', 'Región Metropolitana de Santiago'),
  ('Tiltil', 'Región Metropolitana de Santiago'),
  ('San Bernardo', 'Región Metropolitana de Santiago'),
  ('Buin', 'Región Metropolitana de Santiago'),
  ('Calera de Tango', 'Región Metropolitana de Santiago'),
  ('Paine', 'Región Metropolitana de Santiago'),
  ('Melipilla', 'Región Metropolitana de Santiago'),
  ('Alhué', 'Región Metropolitana de Santiago'),
  ('Curacaví', 'Región Metropolitana de Santiago'),
  ('María Pinto', 'Región Metropolitana de Santiago'),
  ('San Pedro', 'Región Metropolitana de Santiago'),
  ('Talagante', 'Región Metropolitana de Santiago'),
  ('El Monte', 'Región Metropolitana de Santiago'),
  ('Isla de Maipo', 'Región Metropolitana de Santiago'),
  ('Padre Hurtado', 'Región Metropolitana de Santiago'),
  ('Peñaflor', 'Región Metropolitana de Santiago'),
  ('Rancagua', 'Región del Libertador General Bernardo O''Higgins'),
  ('Codegua', 'Región del Libertador General Bernardo O''Higgins'),
  ('Coinco', 'Región del Libertador General Bernardo O''Higgins'),
  ('Coltauco', 'Región del Libertador General Bernardo O''Higgins'),
  ('Doñihue', 'Región del Libertador General Bernardo O''Higgins'),
  ('Graneros', 'Región del Libertador General Bernardo O''Higgins'),
  ('Las Cabras', 'Región del Libertador General Bernardo O''Higgins'),
  ('Machalí', 'Región del Libertador General Bernardo O''Higgins'),
  ('Malloa', 'Región del Libertador General Bernardo O''Higgins'),
  ('Mostazal', 'Región del Libertador General Bernardo O''Higgins'),
  ('Olivar', 'Región del Libertador General Bernardo O''Higgins'),
  ('Peumo', 'Región del Libertador General Bernardo O''Higgins'),
  ('Pichidegua', 'Región del Libertador General Bernardo O''Higgins'),
  ('Quinta de Tilcoco', 'Región del Libertador General Bernardo O''Higgins'),
  ('Rengo', 'Región del Libertador General Bernardo O''Higgins'),
  ('Requínoa', 'Región del Libertador General Bernardo O''Higgins'),
  ('San Vicente', 'Región del Libertador General Bernardo O''Higgins'),
  ('Pichilemu', 'Región del Libertador General Bernardo O''Higgins'),
  ('La Estrella', 'Región del Libertador General Bernardo O''Higgins'),
  ('Litueche', 'Región del Libertador General Bernardo O''Higgins'),
  ('Marchihue', 'Región del Libertador General Bernardo O''Higgins'),
  ('Navidad', 'Región del Libertador General Bernardo O''Higgins'),
  ('Paredones', 'Región del Libertador General Bernardo O''Higgins'),
  ('San Fernando', 'Región del Libertador General Bernardo O''Higgins'),
  ('Chépica', 'Región del Libertador General Bernardo O''Higgins'),
  ('Chimbarongo', 'Región del Libertador General Bernardo O''Higgins'),
  ('Lolol', 'Región del Libertador General Bernardo O''Higgins'),
  ('Nancagua', 'Región del Libertador General Bernardo O''Higgins'),
  ('Palmilla', 'Región del Libertador General Bernardo O''Higgins'),
  ('Peralillo', 'Región del Libertador General Bernardo O''Higgins'),
  ('Placilla', 'Región del Libertador General Bernardo O''Higgins'),
  ('Pumanque', 'Región del Libertador General Bernardo O''Higgins'),
  ('Santa Cruz', 'Región del Libertador General Bernardo O''Higgins'),
  ('Talca', 'Región del Maule'),
  ('Constitución', 'Región del Maule'),
  ('Curepto', 'Región del Maule'),
  ('Empedrado', 'Región del Maule'),
  ('Maule', 'Región del Maule'),
  ('Pelarco', 'Región del Maule'),
  ('Pencahue', 'Región del Maule'),
  ('Río Claro', 'Región del Maule'),
  ('San Clemente', 'Región del Maule'),
  ('San Rafael', 'Región del Maule'),
  ('Cauquenes', 'Región del Maule'),
  ('Chanco', 'Región del Maule'),
  ('Pelluhue', 'Región del Maule'),
  ('Curicó', 'Región del Maule'),
  ('Hualañé', 'Región del Maule'),
  ('Licantén', 'Región del Maule'),
  ('Molina', 'Región del Maule'),
  ('Rauco', 'Región del Maule'),
  ('Romeral', 'Región del Maule'),
  ('Sagrada Familia', 'Región del Maule'),
  ('Teno', 'Región del Maule'),
  ('Vichuquén', 'Región del Maule'),
  ('Linares', 'Región del Maule'),
  ('Colbún', 'Región del Maule'),
  ('Longaví', 'Región del Maule'),
  ('Parral', 'Región del Maule'),
  ('Retiro', 'Región del Maule'),
  ('San Javier', 'Región del Maule'),
  ('Villa Alegre', 'Región del Maule'),
  ('Yerbas Buenas', 'Región del Maule'),
  ('Chillán', 'Región de Ñuble'),
  ('Chillán Viejo', 'Región de Ñuble'),
  ('Bulnes', 'Región de Ñuble'),
  ('Cobquecura', 'Región de Ñuble'),
  ('Coelemu', 'Región de Ñuble'),
  ('Coihueco', 'Región de Ñuble'),
  ('El Carmen', 'Región de Ñuble'),
  ('Ninhue', 'Región de Ñuble'),
  ('Ñiquén', 'Región de Ñuble'),
  ('Pemuco', 'Región de Ñuble'),
  ('Pinto', 'Región de Ñuble'),
  ('Portezuelo', 'Región de Ñuble'),
  ('Quillón', 'Región de Ñuble'),
  ('Quirihue', 'Región de Ñuble'),
  ('Ránquil', 'Región de Ñuble'),
  ('San Carlos', 'Región de Ñuble'),
  ('San Fabián', 'Región de Ñuble'),
  ('San Ignacio', 'Región de Ñuble'),
  ('San Nicolás', 'Región de Ñuble'),
  ('Treguaco', 'Región de Ñuble'),
  ('Yungay', 'Región de Ñuble'),
  ('Concepción', 'Región del Biobío'),
  ('Coronel', 'Región del Biobío'),
  ('Chiguayante', 'Región del Biobío'),
  ('Florida', 'Región del Biobío'),
  ('Hualqui', 'Región del Biobío'),
  ('Lota', 'Región del Biobío'),
  ('Penco', 'Región del Biobío'),
  ('San Pedro de la Paz', 'Región del Biobío'),
  ('Santa Juana', 'Región del Biobío'),
  ('Talcahuano', 'Región del Biobío'),
  ('Tomé', 'Región del Biobío'),
  ('Hualpén', 'Región del Biobío'),
  ('Lebu', 'Región del Biobío'),
  ('Arauco', 'Región del Biobío'),
  ('Cañete', 'Región del Biobío'),
  ('Contulmo', 'Región del Biobío'),
  ('Curanilahue', 'Región del Biobío'),
  ('Los Álamos', 'Región del Biobío'),
  ('Tirúa', 'Región del Biobío'),
  ('Los Ángeles', 'Región del Biobío'),
  ('Antuco', 'Región del Biobío'),
  ('Cabrero', 'Región del Biobío'),
  ('Laja', 'Región del Biobío'),
  ('Mulchén', 'Región del Biobío'),
  ('Nacimiento', 'Región del Biobío'),
  ('Negrete', 'Región del Biobío'),
  ('Quilaco', 'Región del Biobío'),
  ('Quilleco', 'Región del Biobío'),
  ('San Rosendo', 'Región del Biobío'),
  ('Santa Bárbara', 'Región del Biobío'),
  ('Tucapel', 'Región del Biobío'),
  ('Yumbel', 'Región del Biobío'),
  ('Alto Biobío', 'Región del Biobío'),
  ('Temuco', 'Región de La Araucanía'),
  ('Carahue', 'Región de La Araucanía'),
  ('Cunco', 'Región de La Araucanía'),
  ('Curarrehue', 'Región de La Araucanía'),
  ('Freire', 'Región de La Araucanía'),
  ('Galvarino', 'Región de La Araucanía'),
  ('Gorbea', 'Región de La Araucanía'),
  ('Lautaro', 'Región de La Araucanía'),
  ('Loncoche', 'Región de La Araucanía'),
  ('Melipeuco', 'Región de La Araucanía'),
  ('Nueva Imperial', 'Región de La Araucanía'),
  ('Padre Las Casas', 'Región de La Araucanía'),
  ('Perquenco', 'Región de La Araucanía'),
  ('Pitrufquén', 'Región de La Araucanía'),
  ('Pucón', 'Región de La Araucanía'),
  ('Saavedra', 'Región de La Araucanía'),
  ('Teodoro Schmidt', 'Región de La Araucanía'),
  ('Toltén', 'Región de La Araucanía'),
  ('Vilcún', 'Región de La Araucanía'),
  ('Villarrica', 'Región de La Araucanía'),
  ('Cholchol', 'Región de La Araucanía'),
  ('Angol', 'Región de La Araucanía'),
  ('Collipulli', 'Región de La Araucanía'),
  ('Curacautín', 'Región de La Araucanía'),
  ('Ercilla', 'Región de La Araucanía'),
  ('Lonquimay', 'Región de La Araucanía'),
  ('Los Sauces', 'Región de La Araucanía'),
  ('Lumaco', 'Región de La Araucanía'),
  ('Purén', 'Región de La Araucanía'),
  ('Renaico', 'Región de La Araucanía'),
  ('Traiguén', 'Región de La Araucanía'),
  ('Victoria', 'Región de La Araucanía'),
  ('Valdivia', 'Región de Los Ríos'),
  ('Corral', 'Región de Los Ríos'),
  ('Lanco', 'Región de Los Ríos'),
  ('Los Lagos', 'Región de Los Ríos'),
  ('Máfil', 'Región de Los Ríos'),
  ('Mariquina', 'Región de Los Ríos'),
  ('Paillaco', 'Región de Los Ríos'),
  ('Panguipulli', 'Región de Los Ríos'),
  ('La Unión', 'Región de Los Ríos'),
  ('Futrono', 'Región de Los Ríos'),
  ('Lago Ranco', 'Región de Los Ríos'),
  ('Río Bueno', 'Región de Los Ríos'),
  ('Puerto Montt', 'Región de Los Lagos'),
  ('Calbuco', 'Región de Los Lagos'),
  ('Cochamó', 'Región de Los Lagos'),
  ('Fresia', 'Región de Los Lagos'),
  ('Frutillar', 'Región de Los Lagos'),
  ('Los Muermos', 'Región de Los Lagos'),
  ('Llanquihue', 'Región de Los Lagos'),
  ('Maullín', 'Región de Los Lagos'),
  ('Puerto Varas', 'Región de Los Lagos'),
  ('Castro', 'Región de Los Lagos'),
  ('Ancud', 'Región de Los Lagos'),
  ('Chonchi', 'Región de Los Lagos'),
  ('Curaco de Vélez', 'Región de Los Lagos'),
  ('Dalcahue', 'Región de Los Lagos'),
  ('Puqueldón', 'Región de Los Lagos'),
  ('Queilén', 'Región de Los Lagos'),
  ('Quellón', 'Región de Los Lagos'),
  ('Quemchi', 'Región de Los Lagos'),
  ('Quinchao', 'Región de Los Lagos'),
  ('Osorno', 'Región de Los Lagos'),
  ('Puerto Octay', 'Región de Los Lagos'),
  ('Purranque', 'Región de Los Lagos'),
  ('Puyehue', 'Región de Los Lagos'),
  ('Río Negro', 'Región de Los Lagos'),
  ('San Juan de la Costa', 'Región de Los Lagos'),
  ('San Pablo', 'Región de Los Lagos'),
  ('Chaitén', 'Región de Los Lagos'),
  ('Futaleufú', 'Región de Los Lagos'),
  ('Hualaihué', 'Región de Los Lagos'),
  ('Palena', 'Región de Los Lagos'),
  ('Coyhaique', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('Lago Verde', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('Aysén', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('Cisnes', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('Guaitecas', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('Cochrane', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('O''Higgins', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('Tortel', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('Chile Chico', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('Río Ibáñez', 'Región de Aysén del General Carlos Ibáñez del Campo'),
  ('Punta Arenas', 'Región de Magallanes y de la Antártica Chilena'),
  ('Laguna Blanca', 'Región de Magallanes y de la Antártica Chilena'),
  ('Río Verde', 'Región de Magallanes y de la Antártica Chilena'),
  ('San Gregorio', 'Región de Magallanes y de la Antártica Chilena'),
  ('Cabo de Hornos', 'Región de Magallanes y de la Antártica Chilena'),
  ('Antártica', 'Región de Magallanes y de la Antártica Chilena'),
  ('Porvenir', 'Región de Magallanes y de la Antártica Chilena'),
  ('Primavera', 'Región de Magallanes y de la Antártica Chilena'),
  ('Timaukel', 'Región de Magallanes y de la Antártica Chilena'),
  ('Natales', 'Región de Magallanes y de la Antártica Chilena'),
  ('Torres del Paine', 'Región de Magallanes y de la Antártica Chilena')
on conflict (comuna) do update set region = excluded.region;

-- public read: the checkout form needs this client-side too (or at least
-- server components rendering it could), and it's non-sensitive reference
-- data — same trust level as the region/comuna names hardcoded in the UI.
alter table public.cl_comunas enable row level security;
create policy "public read cl_comunas" on public.cl_comunas for select using (true);
create policy "catalog managers manage cl_comunas" on public.cl_comunas for all
  using (public.has_role('admin') or public.has_role('staff'))
  with check (public.has_role('admin') or public.has_role('staff'));

-- ==========================================================================
-- 2. orders: shipping policy, carrier preference, billing document type/data
-- ==========================================================================
-- orders has 0 rows right now, so NOT NULL + defaults are safe to add
-- without a backfill.
alter table public.orders
  add column if not exists shipping_policy text not null default 'receiver_pays'
    check (shipping_policy in ('free', 'receiver_pays'));

alter table public.orders
  add column if not exists preferred_carrier text
    check (preferred_carrier is null or preferred_carrier in ('starken', 'chilexpress', 'blue_express'));

alter table public.orders
  add column if not exists billing_document_type text not null default 'boleta'
    check (billing_document_type in ('boleta', 'factura'));

-- Structure (documented here since it's jsonb, not real columns): rut
-- (normalized, digits + check digit, no dots/dash), businessName,
-- businessActivity, email, region, comuna, address, number, unit (nullable).
-- Populated only when billing_document_type = 'factura' — see the
-- constraint right below, which enforces that pairing at the table level in
-- addition to the RPC's own validation.
alter table public.orders
  add column if not exists billing_data jsonb;

alter table public.orders
  add constraint orders_billing_data_matches_document_type
  check (
    (billing_document_type = 'boleta' and billing_data is null)
    or (billing_document_type = 'factura' and billing_data is not null)
  );

-- ==========================================================================
-- 3. is_valid_rut(text) — mirrors src/features/checkout/rut.ts exactly
-- (modulo-11 check digit), so a direct RPC call can't create an invoice
-- with a garbage RUT even if it skips the client/app-layer validation.
-- ==========================================================================
create or replace function public.is_valid_rut(p_rut text)
returns boolean
language plpgsql immutable as $$
declare
  normalized text;
  body text;
  check_digit text;
  computed text;
  total integer := 0;
  multiplier integer := 2;
  i integer;
  digit integer;
  remainder integer;
begin
  normalized := upper(regexp_replace(p_rut, '[^0-9kK]', '', 'g'));
  if length(normalized) < 2 then
    return false;
  end if;
  body := substring(normalized from 1 for length(normalized) - 1);
  check_digit := substring(normalized from length(normalized) for 1);
  if body !~ '^[0-9]{1,8}$' then
    return false;
  end if;

  for i in reverse length(body)..1 loop
    digit := substring(body from i for 1)::integer;
    total := total + digit * multiplier;
    multiplier := case when multiplier = 7 then 2 else multiplier + 1 end;
  end loop;

  remainder := 11 - (total % 11);
  computed := case
    when remainder = 11 then '0'
    when remainder = 10 then 'K'
    else remainder::text
  end;

  return computed = check_digit;
end;
$$;

-- ==========================================================================
-- 4. create_pending_order — now also validates and persists shipping
-- policy (server-computed, never trusted from the client), preferred
-- carrier (allowlisted), billing document type and billing data (validated
-- — RUT check digit, required fields, region/comuna pair — only when
-- billing_document_type = 'factura'). Everything about item/price/stock
-- revalidation is unchanged from the previous version.
-- ==========================================================================
drop function if exists public.create_pending_order(jsonb, text, text, text, jsonb, text);

create or replace function public.create_pending_order(
  p_items jsonb,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_notes text,
  p_preferred_carrier text,
  p_billing_document_type text default 'boleta',
  p_billing_data jsonb default null
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

  -- shipping_policy is derived from the server-computed subtotal only —
  -- the client never sends this value at all, so there's nothing to ignore
  -- even if a manipulated request tried to include one.
  v_shipping_policy := case when v_subtotal >= 50000 then 'free' else 'receiver_pays' end;

  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  insert into public.orders (
    customer_id, customer_email, customer_name, customer_phone,
    status, payment_status, currency, subtotal, discount_total, shipping_total, total,
    shipping_address, notes, confirmation_token,
    shipping_policy, preferred_carrier, billing_document_type, billing_data
  ) values (
    auth.uid(), trim(p_customer_email), trim(p_customer_name), nullif(trim(coalesce(p_customer_phone, '')), ''),
    'pending', 'pending', 'CLP', v_subtotal, 0, 0, v_subtotal,
    p_shipping_address, nullif(trim(coalesce(p_notes, '')), ''), v_token,
    v_shipping_policy, p_preferred_carrier, v_billing_document_type,
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

grant execute on function public.create_pending_order(jsonb, text, text, text, jsonb, text, text, text, jsonb) to anon, authenticated;
