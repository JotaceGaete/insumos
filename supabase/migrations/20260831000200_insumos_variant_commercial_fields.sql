-- Extend the independent insumos variant model. Do not run this against ARTEMA.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_variants' and column_name = 'unit_label'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_variants' and column_name = 'unit'
  ) then
    alter table public.product_variants rename column unit_label to unit;
  end if;
end $$;

alter table public.product_variants
  add column if not exists option_value text,
  add column if not exists wholesale_price integer check (wholesale_price is null or wholesale_price >= 0),
  add column if not exists cost_price integer check (cost_price is null or cost_price >= 0),
  add column if not exists weight_grams integer check (weight_grams is null or weight_grams >= 0);
