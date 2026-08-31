import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260831000100_insumos_foundation.sql', root);
const commercialVariantMigrationPath = new URL('supabase/migrations/20260831000200_insumos_variant_commercial_fields.sql', root);
const productMediaStorageMigrationPath = new URL('supabase/migrations/20260831000300_insumos_product_media_storage.sql', root);

async function loadTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, root), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const outputModule = { exports: {} };
  vm.runInNewContext(compiled, { module: outputModule, exports: outputModule.exports });
  return outputModule.exports;
}

const migration = () => readFile(migrationPath, 'utf8');

test('migration creates the complete catalog and inventory traceability foundation', async () => {
  const sql = await migration();
  for (const table of ['profiles', 'user_roles', 'categories', 'products', 'product_variants', 'product_media', 'product_documents', 'product_related', 'price_tiers', 'inventory_movements']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(sql, /record_inventory_movement/);
  assert.match(sql, /for update/);
  assert.match(sql, /balance_after/);
});

test('RLS permits role changes only to admins and catalog writes only to catalog managers', async () => {
  const sql = await migration();
  assert.match(sql, /roles admin manage[\s\S]*public\.has_role\('admin'\)/);
  assert.doesNotMatch(sql, /roles staff manage/);
  for (const table of ['categories', 'products', 'product_variants', 'price_tiers', 'inventory_movements']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /catalog managers manage variants/);
  assert.doesNotMatch(sql, /NEXT_PUBLIC_ADMIN_BYPASS/);
});

test('service role is server-only and never declared as a public environment variable', async () => {
  const envExample = await readFile(new URL('.env.example', root), 'utf8');
  const serverClient = await readFile(new URL('src/features/shared/server/supabase.ts', root), 'utf8');
  assert.match(envExample, /^INSUMOS_SUPABASE_SERVICE_ROLE_KEY=/m);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_INSUMOS_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(serverClient, /process\.env\.INSUMOS_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(serverClient, /import 'server-only'/);
});

test('cart merges identical product and variant identities only', async () => {
  const { EMPTY_CART, addCartLine } = await loadTypeScript('src/features/cart/cartReducer.ts');
  const first = { productId: 'product-a', variantId: 'variant-1', productName: 'A', variantName: '100 ml', sku: 'A-100', unitPrice: 1000, quantity: 1 };
  const sameVariant = { ...first, quantity: 2 };
  const otherVariant = { ...first, variantId: 'variant-2', sku: 'A-500', quantity: 1 };
  const otherProduct = { ...first, productId: 'product-b', variantId: 'variant-1', sku: 'B-100', quantity: 1 };
  const afterSame = addCartLine(addCartLine(EMPTY_CART, first), sameVariant);
  assert.equal(afterSame.lines.length, 1);
  assert.equal(afterSame.lines[0].quantity, 3);
  const afterVariants = addCartLine(afterSame, otherVariant);
  const afterProducts = addCartLine(afterVariants, otherProduct);
  assert.equal(afterProducts.lines.length, 3);
  assert.equal(afterProducts.itemCount, 5);
});

test('cart removes by composite identity and rejects invalid quantities', async () => {
  const { EMPTY_CART, addCartLine, setCartLineQuantity } = await loadTypeScript('src/features/cart/cartReducer.ts');
  const base = { productId: 'product-a', variantId: 'variant-1', productName: 'A', variantName: '100 ml', sku: 'A-100', unitPrice: 1000, quantity: 2 };
  const other = { ...base, variantId: 'variant-2', sku: 'A-500', quantity: 1 };
  const cart = addCartLine(addCartLine(EMPTY_CART, base), other);
  const updated = setCartLineQuantity(cart, 'product-a', 'variant-1', 4);
  assert.equal(updated.lines.find((line) => line.variantId === 'variant-1').quantity, 4);
  const removed = setCartLineQuantity(updated, 'product-a', 'variant-1', 0);
  assert.equal(removed.lines.length, 1);
  assert.equal(removed.lines[0].variantId, 'variant-2');
  assert.throws(() => setCartLineQuantity(cart, 'product-a', 'variant-2', -1));
  assert.throws(() => setCartLineQuantity(cart, 'product-a', 'variant-2', 1.5));
});

test('cart does not access localStorage and treats price as a display snapshot', async () => {
  const source = await readFile(new URL('src/features/cart/cartReducer.ts', root), 'utf8');
  const types = await readFile(new URL('src/features/cart/types.ts', root), 'utf8');
  assert.doesNotMatch(source, /localStorage/);
  assert.match(types, /Snapshot for display only/);
});

test('price tiers resolve one deterministic range and reject invalid quantities', async () => {
  const { resolvePriceTier } = await loadTypeScript('src/features/pricing/resolvePriceTier.ts');
  const tiers = [
    { id: '1', variantId: 'v', audience: 'retail', minimumQuantity: 1, maximumQuantity: 4, unitPrice: 1000, currency: 'CLP' },
    { id: '2', variantId: 'v', audience: 'retail', minimumQuantity: 5, maximumQuantity: 9, unitPrice: 900, currency: 'CLP' },
    { id: '3', variantId: 'v', audience: 'retail', minimumQuantity: 10, maximumQuantity: 24, unitPrice: 800, currency: 'CLP' },
    { id: '4', variantId: 'v', audience: 'retail', minimumQuantity: 25, maximumQuantity: null, unitPrice: 700, currency: 'CLP' },
  ];
  assert.equal(resolvePriceTier(tiers, 1).unitPrice, 1000);
  assert.equal(resolvePriceTier(tiers, 9).unitPrice, 900);
  assert.equal(resolvePriceTier(tiers, 25).unitPrice, 700);
  assert.throws(() => resolvePriceTier(tiers, 0));
  assert.throws(() => resolvePriceTier([...tiers, { ...tiers[0], id: 'overlap', minimumQuantity: 3, maximumQuantity: 6 }], 3));
});

test('price-tier schema prevents overlapping ranges for one variant and audience', async () => {
  const sql = await migration();
  assert.match(sql, /price_tiers_no_overlapping_ranges/);
  assert.match(sql, /int4range\(minimum_quantity, coalesce\(maximum_quantity, 2147483647\), '\[\]'\) with &&/);
  assert.match(sql, /maximum_quantity integer check \(maximum_quantity is null or maximum_quantity >= minimum_quantity\)/);
});

test('inventory convention uses signed deltas and the database enforces it atomically', async () => {
  const { assertInventoryMovementConvention } = await loadTypeScript('src/features/inventory/movementRules.ts');
  for (const [type, quantity] of [['purchase', 4], ['return', 2], ['sale', -1], ['reservation', -2], ['release', 2], ['adjustment', -3]]) {
    assert.doesNotThrow(() => assertInventoryMovementConvention(type, quantity));
  }
  assert.throws(() => assertInventoryMovementConvention('purchase', -1));
  assert.throws(() => assertInventoryMovementConvention('sale', 1));
  const sql = await migration();
  assert.match(sql, /select stock_quantity into current_stock[\s\S]*for update/);
  assert.match(sql, /if resulting_stock < 0 then raise exception 'Insufficient stock'/);
  assert.match(sql, /update public\.product_variants set stock_quantity = resulting_stock/);
  assert.match(sql, /insert into public\.inventory_movements/);
});

test('category hierarchy accepts roots and valid children but rejects self-parenting and cycles', async () => {
  const { canAssignCategoryParent } = await loadTypeScript('src/features/catalog/categoryHierarchy.ts');
  const categories = [
    { id: 'root', parentId: null },
    { id: 'child', parentId: 'root' },
    { id: 'grandchild', parentId: 'child' },
  ];
  assert.equal(canAssignCategoryParent(categories, 'root', null), true);
  assert.equal(canAssignCategoryParent(categories, 'grandchild', 'root'), true);
  assert.equal(canAssignCategoryParent(categories, 'child', 'child'), false);
  assert.equal(canAssignCategoryParent(categories, 'root', 'grandchild'), false);
  const sql = await migration();
  assert.match(sql, /categories_parent_not_self/);
  assert.match(sql, /prevent_category_cycle/);
});

test('admin extensions keep commercial values on variants and do not expose a legacy admin bypass', async () => {
  const sql = await readFile(commercialVariantMigrationPath, 'utf8');
  const editor = await readFile(new URL('src/features/admin/components/ProductEditor.tsx', root), 'utf8');
  const adminLayout = await readFile(new URL('src/app/admin/layout.tsx', root), 'utf8');
  const inventoryRoute = await readFile(new URL('src/app/api/insumos/admin/variants/[id]/inventory/route.ts', root), 'utf8');
  const middleware = await readFile(new URL('src/middleware.ts', root), 'utf8');
  assert.match(sql, /option_value text/);
  assert.match(sql, /wholesale_price integer/);
  assert.match(sql, /cost_price integer/);
  assert.match(sql, /weight_grams integer/);
  assert.match(sql, /rename column unit_label to unit/);
  assert.match(inventoryRoute, /recordInventoryMovement/);
  assert.doesNotMatch(editor, /stock_quantity:\s*Number/);
  assert.match(adminLayout, /requireCatalogManager/);
  assert.doesNotMatch(adminLayout, /AdminProtection|sessionStorage|ADMIN_PASSWORD/);
  assert.match(middleware, /startsWith\('\/api\/admin\/'\)/);
  assert.match(middleware, /status: 410/);
});

test('category admin has a visible submit action and sends the complete insumos payload', async () => {
  const manager = await readFile(new URL('src/features/admin/components/CategoryManager.tsx', root), 'utf8');
  const route = await readFile(new URL('src/app/api/insumos/admin/categories/route.ts', root), 'utf8');
  const tailwindConfig = await readFile(new URL('tailwind.config.js', root), 'utf8');
  assert.match(manager, /type="submit"/);
  assert.match(manager, /Crear categoría/);
  assert.match(manager, /Creando\.\.\./);
  for (const property of ['name', 'slug', 'parent_id', 'description', 'is_active', 'sort_order']) {
    assert.match(manager, new RegExp(`${property}:`));
  }
  assert.match(route, /parentId: body\.parent_id/);
  assert.match(route, /isActive: body\.is_active/);
  assert.match(route, /sortOrder: body\.sort_order/);
  assert.match(tailwindConfig, /\.\/src\/features\/\*\*\/\*\.\{js,ts,jsx,tsx,mdx\}/);
});

test('product media uses the dedicated insumos bucket and protects storage writes by role', async () => {
  const sql = await readFile(productMediaStorageMigrationPath, 'utf8');
  const uploader = await readFile(new URL('src/features/admin/components/ProductMediaManager.tsx', root), 'utf8');
  const mediaMutations = await readFile(new URL('src/features/catalog/server/mediaMutations.ts', root), 'utf8');
  const homeCatalog = await readFile(new URL('src/features/catalog/components/HomeCatalog.tsx', root), 'utf8');
  assert.match(sql, /'product-media'/);
  assert.match(sql, /file_size_limit[\s\S]*8388608/);
  assert.match(sql, /image\/jpeg/);
  assert.match(sql, /catalog managers upload insumos product media/);
  assert.match(sql, /public\.has_role\('admin'\) or public\.has_role\('staff'\)/);
  assert.match(uploader, /products\/\$\{productId\}/);
  assert.match(uploader, /MAX_FILE_SIZE/);
  assert.match(uploader, /createInsumosSupabaseBrowser/);
  assert.doesNotMatch(uploader, /@\/lib\/supabase|NEXT_PUBLIC_SUPABASE/);
  assert.match(mediaMutations, /requireCatalogManager/);
  assert.match(mediaMutations, /storage\.from\(PRODUCT_MEDIA_BUCKET\)\.remove/);
  assert.match(homeCatalog, /getProductMediaPublicUrl/);
});

test('public product listing is isolated from legacy commerce and uses foundation catalog data', async () => {
  const page = await readFile(new URL('src/app/productos/page.tsx', root), 'utf8');
  const catalog = await readFile(new URL('src/features/catalog/components/PublicCatalogPage.tsx', root), 'utf8');
  assert.match(page, /listCatalogProductListings/);
  assert.match(page, /PublicCatalogPage/);
  assert.doesNotMatch(page, /woocommerce|@\/lib\/supabase|ProductCard|ProductAdapter|NEXT_PUBLIC_SUPABASE/);
  assert.match(catalog, /getProductMediaPublicUrl/);
  assert.match(catalog, /variant\.retailPrice/);
  assert.match(catalog, /variant\.stockQuantity/);
  assert.match(catalog, /categoryId/);
  assert.match(catalog, /type="search"/);
  assert.match(catalog, /href=\{`\/producto\/\$\{listing\.product\.slug\}/);
  assert.doesNotMatch(catalog, /woocommerce|@\/lib\/supabase|NEXT_PUBLIC_SUPABASE/);
});

test('all migrated public catalog routes stay within the insumos foundation', async () => {
  const pages = await Promise.all([
    'src/app/page.tsx',
    'src/app/productos/page.tsx',
    'src/app/producto/[slug]/page.tsx',
    'src/app/categoria/[slug]/page.tsx',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const catalogQueries = await readFile(new URL('src/features/catalog/server/queries.ts', root), 'utf8');
  const productDetail = await readFile(new URL('src/features/catalog/components/ProductDetail.tsx', root), 'utf8');
  for (const source of [...pages, catalogQueries, productDetail]) {
    assert.doesNotMatch(source, /@\/lib\/supabase|@\/lib\/woocommerce|supabaseServerUtils|productAdapter|ProductAdapter|NEXT_PUBLIC_SUPABASE/);
  }
  assert.match(pages[2], /getCatalogProductListing/);
  assert.match(pages[3], /getCatalogCategory/);
  assert.match(productDetail, /selectedVariantId/);
  assert.match(productDetail, /selectedVariant\.retailPrice/);
  assert.match(productDetail, /selectedVariant\.stockQuantity/);
  assert.match(productDetail, /getProductMediaPublicUrl/);
});
