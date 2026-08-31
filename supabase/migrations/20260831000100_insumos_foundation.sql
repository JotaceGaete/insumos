-- Foundation for the independent insumos store. Apply only to its own Supabase project.
create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin', 'staff', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_status as enum ('active', 'draft', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.price_audience as enum ('retail', 'wholesale');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_kind as enum ('technical_sheet', 'safety_sheet', 'certificate', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inventory_movement_type as enum ('initial', 'purchase', 'sale', 'adjustment', 'return', 'reservation', 'release');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(trim(name)) > 0),
  constraint categories_slug_not_blank check (length(trim(slug)) > 0),
  constraint categories_parent_not_self check (parent_id is null or parent_id <> id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  brand text,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (length(trim(name)) > 0),
  constraint products_slug_not_blank check (length(trim(slug)) > 0)
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  name text not null,
  attributes jsonb not null default '{}'::jsonb,
  unit_label text,
  quantity_value numeric(12, 3),
  retail_price integer not null check (retail_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  min_quantity integer not null default 1 check (min_quantity > 0),
  max_quantity integer check (max_quantity is null or max_quantity >= min_quantity),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variants_sku_not_blank check (length(trim(sku)) > 0),
  constraint variants_name_not_blank check (length(trim(name)) > 0),
  constraint variants_quantity_value_positive check (quantity_value is null or quantity_value > 0)
);

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint product_media_path_not_blank check (length(trim(storage_path)) > 0)
);

create unique index if not exists product_media_one_primary_per_product
  on public.product_media(product_id) where is_primary;

create table if not exists public.product_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind public.document_kind not null,
  title text not null,
  storage_path text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint product_documents_title_not_blank check (length(trim(title)) > 0),
  constraint product_documents_path_not_blank check (length(trim(storage_path)) > 0)
);

create table if not exists public.product_related (
  product_id uuid not null references public.products(id) on delete cascade,
  related_product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, related_product_id),
  constraint product_related_not_self check (product_id <> related_product_id)
);

create table if not exists public.price_tiers (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  audience public.price_audience not null,
  minimum_quantity integer not null check (minimum_quantity > 0),
  maximum_quantity integer check (maximum_quantity is null or maximum_quantity >= minimum_quantity),
  unit_price integer not null check (unit_price >= 0),
  currency char(3) not null default 'CLP' check (currency = 'CLP'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (variant_id, audience, minimum_quantity)
);

create extension if not exists btree_gist;
alter table public.price_tiers
  add constraint price_tiers_no_overlapping_ranges
  exclude using gist (
    variant_id with =,
    audience with =,
    int4range(minimum_quantity, coalesce(maximum_quantity, 2147483647), '[]') with &&
  );

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  movement_type public.inventory_movement_type not null,
  quantity_delta integer not null check (quantity_delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_variant_created_at_idx
  on public.inventory_movements(variant_id, created_at desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_email text not null,
  customer_name text not null,
  customer_phone text,
  status text not null default 'pending',
  payment_status text not null default 'pending',
  payment_provider text,
  payment_reference text unique,
  currency char(3) not null default 'CLP' check (currency = 'CLP'),
  subtotal integer not null check (subtotal >= 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  shipping_total integer not null default 0 check (shipping_total >= 0),
  total integer not null check (total >= 0),
  shipping_address jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_category_cycle()
returns trigger language plpgsql as $$
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then raise exception 'A category cannot be its own parent'; end if;
  if exists (
    with recursive ancestors as (
      select id, parent_id from public.categories where id = new.parent_id
      union all
      select category.id, category.parent_id
      from public.categories category
      join ancestors ancestor on category.id = ancestor.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'Category parent would create a cycle';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists categories_prevent_cycle on public.categories;
create trigger categories_prevent_cycle before insert or update of parent_id on public.categories for each row execute function public.prevent_category_cycle();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists variants_set_updated_at on public.product_variants;
create trigger variants_set_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
drop trigger if exists price_tiers_set_updated_at on public.price_tiers;
create trigger price_tiers_set_updated_at before update on public.price_tiers for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.raw_user_meta_data ->> 'display_name') on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'customer') on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.has_role(requested_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = requested_role
  );
$$;

create or replace function public.record_inventory_movement(
  p_variant_id uuid,
  p_quantity_delta integer,
  p_movement_type public.inventory_movement_type,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_note text default null
)
returns public.inventory_movements
language plpgsql security definer set search_path = public as $$
declare
  current_stock integer;
  resulting_stock integer;
  movement public.inventory_movements;
begin
  if not public.has_role('admin') and not public.has_role('staff') then
    raise exception 'Not authorized to update inventory';
  end if;
  if p_quantity_delta = 0 then
    raise exception 'Inventory movement quantity cannot be zero';
  end if;
  if p_movement_type in ('initial', 'purchase', 'return', 'release') and p_quantity_delta < 0 then
    raise exception '% movements must increase stock', p_movement_type;
  end if;
  if p_movement_type in ('sale', 'reservation') and p_quantity_delta > 0 then
    raise exception '% movements must decrease stock', p_movement_type;
  end if;

  select stock_quantity into current_stock from public.product_variants where id = p_variant_id for update;
  if current_stock is null then raise exception 'Variant not found'; end if;
  resulting_stock := current_stock + p_quantity_delta;
  if resulting_stock < 0 then raise exception 'Insufficient stock'; end if;

  update public.product_variants set stock_quantity = resulting_stock where id = p_variant_id;
  insert into public.inventory_movements (
    variant_id, movement_type, quantity_delta, balance_after, reference_type, reference_id, note, created_by
  ) values (
    p_variant_id, p_movement_type, p_quantity_delta, resulting_stock, p_reference_type, p_reference_id, p_note, auth.uid()
  ) returning * into movement;
  return movement;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_media enable row level security;
alter table public.product_documents enable row level security;
alter table public.product_related enable row level security;
alter table public.price_tiers enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "profiles read own" on public.profiles for select using (id = auth.uid() or public.has_role('admin'));
create policy "profiles update own" on public.profiles for update using (id = auth.uid() or public.has_role('admin')) with check (id = auth.uid() or public.has_role('admin'));
create policy "roles read own" on public.user_roles for select using (user_id = auth.uid() or public.has_role('admin'));
create policy "roles admin manage" on public.user_roles for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "active categories public read" on public.categories for select using (is_active or public.has_role('admin') or public.has_role('staff'));
create policy "catalog managers manage categories" on public.categories for all using (public.has_role('admin') or public.has_role('staff')) with check (public.has_role('admin') or public.has_role('staff'));
create policy "active products public read" on public.products for select using (status = 'active' or public.has_role('admin') or public.has_role('staff'));
create policy "catalog managers manage products" on public.products for all using (public.has_role('admin') or public.has_role('staff')) with check (public.has_role('admin') or public.has_role('staff'));
create policy "active variants public read" on public.product_variants for select using (is_active or public.has_role('admin') or public.has_role('staff'));
create policy "catalog managers manage variants" on public.product_variants for all using (public.has_role('admin') or public.has_role('staff')) with check (public.has_role('admin') or public.has_role('staff'));
create policy "public product media read" on public.product_media for select using (
  exists (select 1 from public.products where products.id = product_media.product_id and products.status = 'active')
  or public.has_role('admin') or public.has_role('staff')
);
create policy "catalog managers manage media" on public.product_media for all using (public.has_role('admin') or public.has_role('staff')) with check (public.has_role('admin') or public.has_role('staff'));
create policy "public documents read" on public.product_documents for select using (
  (is_public and exists (select 1 from public.products where products.id = product_documents.product_id and products.status = 'active'))
  or public.has_role('admin') or public.has_role('staff')
);
create policy "catalog managers manage documents" on public.product_documents for all using (public.has_role('admin') or public.has_role('staff')) with check (public.has_role('admin') or public.has_role('staff'));
create policy "public related products read" on public.product_related for select using (
  exists (select 1 from public.products where products.id = product_related.product_id and products.status = 'active')
  and exists (select 1 from public.products where products.id = product_related.related_product_id and products.status = 'active')
  or public.has_role('admin') or public.has_role('staff')
);
create policy "catalog managers manage related products" on public.product_related for all using (public.has_role('admin') or public.has_role('staff')) with check (public.has_role('admin') or public.has_role('staff'));
create policy "public price tiers read" on public.price_tiers for select using (
  exists (
    select 1 from public.product_variants
    join public.products on products.id = product_variants.product_id
    where product_variants.id = price_tiers.variant_id and product_variants.is_active and products.status = 'active'
  ) or public.has_role('admin') or public.has_role('staff')
);
create policy "catalog managers manage price tiers" on public.price_tiers for all using (public.has_role('admin') or public.has_role('staff')) with check (public.has_role('admin') or public.has_role('staff'));
create policy "catalog managers read inventory movements" on public.inventory_movements for select using (public.has_role('admin') or public.has_role('staff'));
create policy "customers read own orders" on public.orders for select using (customer_id = auth.uid() or public.has_role('admin') or public.has_role('staff'));
create policy "catalog managers manage orders" on public.orders for all using (public.has_role('admin') or public.has_role('staff')) with check (public.has_role('admin') or public.has_role('staff'));
create policy "customers read own order items" on public.order_items for select using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.customer_id = auth.uid()) or public.has_role('admin') or public.has_role('staff'));
create policy "catalog managers manage order items" on public.order_items for all using (public.has_role('admin') or public.has_role('staff')) with check (public.has_role('admin') or public.has_role('staff'));

grant execute on function public.record_inventory_movement(uuid, integer, public.inventory_movement_type, text, uuid, text) to authenticated;

-- Create these buckets manually in the independent project: product-media (public) and product-documents (private).
