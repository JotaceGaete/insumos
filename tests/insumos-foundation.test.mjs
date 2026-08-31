import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const migrationPath = new URL('supabase/migrations/20260831000100_insumos_foundation.sql', root);
const commercialVariantMigrationPath = new URL('supabase/migrations/20260831000200_insumos_variant_commercial_fields.sql', root);
const productMediaStorageMigrationPath = new URL('supabase/migrations/20260831000300_insumos_product_media_storage.sql', root);
// Two files, matching exactly what was actually applied to the live INSUMOS
// project (and in the same order): the original migration (bugs included)
// and the follow-up that fixed them. Kept as two files rather than squashed
// into one so a fresh project replaying local migrations in order ends up
// with the same schema history as production.
const checkoutMigrationPath = new URL('supabase/migrations/20260831194938_insumos_checkout_orders.sql', root);
const checkoutFixMigrationPath = new URL('supabase/migrations/20260831195354_insumos_checkout_fix_for_update_outer_join.sql', root);
const reservationsMigrationPath = new URL('supabase/migrations/20260831202550_insumos_inventory_reservations.sql', root);
const reservationsFixMigrationPath = new URL('supabase/migrations/20260831202912_insumos_inventory_reservations_fix_ambiguous_columns.sql', root);

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
  const provider = await readFile(new URL('src/features/cart/CartProvider.tsx', root), 'utf8');
  assert.doesNotMatch(source, /localStorage/);
  assert.match(types, /Snapshot for display only/);
  assert.match(provider, /arteinsumos\.cart\.v1/);
  assert.match(provider, /window\.localStorage/);
});

test('cart increments, decrements without going below one, and removes explicitly', async () => {
  const { EMPTY_CART, addCartLine, incrementCartLine, decrementCartLine, removeCartLine } = await loadTypeScript('src/features/cart/cartReducer.ts');
  const line = { productId: 'p1', variantId: 'v1', productName: 'A', variantName: '100 ml', sku: 'A-100', unitPrice: 1000, quantity: 1 };
  let cart = addCartLine(EMPTY_CART, line);
  cart = incrementCartLine(cart, 'p1', 'v1');
  assert.equal(cart.lines[0].quantity, 2);
  cart = decrementCartLine(cart, 'p1', 'v1');
  assert.equal(cart.lines[0].quantity, 1);
  cart = decrementCartLine(cart, 'p1', 'v1');
  assert.equal(cart.lines[0].quantity, 1);
  assert.equal(incrementCartLine(EMPTY_CART, 'missing', 'variant').lines.length, 0);
  assert.equal(decrementCartLine(EMPTY_CART, 'missing', 'variant').lines.length, 0);
  cart = removeCartLine(cart, 'p1', 'v1');
  assert.equal(cart.lines.length, 0);
});

test('cart clamps additions and quantity edits to known stock and rejects zero-stock variants', async () => {
  const { EMPTY_CART, addCartLine, setCartLineQuantity } = await loadTypeScript('src/features/cart/cartReducer.ts');
  const line = { productId: 'p1', variantId: 'v1', productName: 'A', variantName: '100 ml', sku: 'A-100', unitPrice: 1000, quantity: 2, stockAvailable: 3 };
  let cart = addCartLine(EMPTY_CART, line);
  assert.equal(cart.lines[0].quantity, 2);
  cart = addCartLine(cart, { ...line, quantity: 5 });
  assert.equal(cart.lines[0].quantity, 3);
  cart = setCartLineQuantity(cart, 'p1', 'v1', 10);
  assert.equal(cart.lines[0].quantity, 3);
  assert.throws(() => addCartLine(EMPTY_CART, { ...line, stockAvailable: 0 }));
});

test('cart clears completely and reports itemCount and subtotal across multiple lines', async () => {
  const { EMPTY_CART, addCartLine, clearCart } = await loadTypeScript('src/features/cart/cartReducer.ts');
  let cart = addCartLine(EMPTY_CART, { productId: 'p1', variantId: 'v1', productName: 'A', variantName: '100 ml', sku: 'A-100', unitPrice: 1000, quantity: 2 });
  cart = addCartLine(cart, { productId: 'p2', variantId: 'v1', productName: 'B', variantName: '500 ml', sku: 'B-500', unitPrice: 3000, quantity: 1 });
  assert.equal(cart.itemCount, 3);
  assert.equal(cart.subtotal, 5000);
  assert.deepEqual(clearCart(), EMPTY_CART);
});

test('hydrateCart rebuilds a valid cart from stored lines and silently drops corrupted entries', async () => {
  const { EMPTY_CART, hydrateCart } = await loadTypeScript('src/features/cart/cartReducer.ts');
  const rebuilt = hydrateCart([
    { productId: 'p1', variantId: 'v1', productName: 'A', variantName: '100 ml', sku: 'A-100', unitPrice: 1000, quantity: 2 },
    { garbage: true },
    { productId: 'p1', variantId: 'v1', productName: 'A', variantName: '100 ml', sku: 'A-100', unitPrice: 1000, quantity: 1 },
  ]);
  assert.equal(rebuilt.lines.length, 1);
  assert.equal(rebuilt.lines[0].quantity, 3);
  assert.deepEqual(hydrateCart('not-an-array'), EMPTY_CART);
  assert.deepEqual(hydrateCart(null), EMPTY_CART);
});

test('insumos cart stays isolated from legacy Artesellos cart, checkout and wholesale modules', async () => {
  const files = await Promise.all([
    'src/features/cart/types.ts',
    'src/features/cart/cartReducer.ts',
    'src/features/cart/CartProvider.tsx',
    'src/features/cart/CartDrawer.tsx',
    'src/app/carrito/page.tsx',
    'src/app/carrito/layout.tsx',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const legacyPattern = /@\/lib\/supabase|@\/lib\/woocommerce|@\/lib\/cartContext|@\/components\/wholesale|@\/app\/checkout|ProductAdapter|NEXT_PUBLIC_SUPABASE/;
  for (const source of files) {
    assert.doesNotMatch(source, legacyPattern);
  }
});

test('recordInventoryMovement uses the session-aware server client so auth.uid() reaches record_inventory_movement', async () => {
  const mutations = await readFile(new URL('src/features/catalog/server/mutations.ts', root), 'utf8');
  const fnMatch = mutations.match(/export async function recordInventoryMovement\([\s\S]*?\n}/);
  assert.ok(fnMatch, 'recordInventoryMovement function not found in mutations.ts');
  const fnBody = fnMatch[0];
  // record_inventory_movement() is SECURITY DEFINER and calls has_role(), which
  // reads auth.uid() from the caller's JWT. The service-role admin client never
  // carries a user JWT, so calling the RPC through it always fails auth inside
  // the function itself — this must go through the cookie/session-based client.
  assert.match(fnBody, /createInsumosSupabaseServer\(\)/);
  assert.doesNotMatch(fnBody, /createInsumosSupabaseAdmin\(\)/);
});

test('the inventory movement route surfaces the real Supabase error message instead of a generic one', async () => {
  const route = await readFile(new URL('src/app/api/insumos/admin/variants/[id]/inventory/route.ts', root), 'utf8');
  // PostgrestError objects reach the catch block as plain {code,message,...}
  // values, not `instanceof Error`, so the route must check for a `.message`
  // property directly rather than relying on instanceof alone.
  assert.match(route, /'message' in error/);
  assert.match(route, /Not authorized to update inventory/);
  assert.match(route, /Insufficient stock/);
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
  const productCard = await readFile(new URL('src/features/catalog/components/ProductCard.tsx', root), 'utf8');
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
  assert.match(productCard, /getProductMediaPublicUrl/);
});

test('public product listing is isolated from legacy commerce and uses foundation catalog data', async () => {
  const page = await readFile(new URL('src/app/productos/page.tsx', root), 'utf8');
  const catalog = await readFile(new URL('src/features/catalog/components/PublicCatalogPage.tsx', root), 'utf8');
  const card = await readFile(new URL('src/features/catalog/components/ProductCard.tsx', root), 'utf8');
  const legacyPattern = /woocommerce|@\/lib\/supabase|@\/components\/ProductCard|ProductAdapter|NEXT_PUBLIC_SUPABASE/;
  assert.match(page, /listCatalogProductListings/);
  assert.match(page, /PublicCatalogPage/);
  assert.doesNotMatch(page, legacyPattern);
  assert.match(catalog, /categoryId/);
  assert.match(catalog, /type="search"/);
  assert.doesNotMatch(catalog, legacyPattern);
  assert.match(card, /getProductMediaPublicUrl/);
  assert.match(card, /variant\.retailPrice/);
  // "Sin stock" badge reflects availableStock (net of active reservations),
  // not raw stockQuantity — see the dedicated availableStock test below.
  assert.match(card, /variant\.availableStock/);
  assert.match(card, /href=\{`\/producto\/\$\{product\.slug\}/);
  assert.doesNotMatch(card, legacyPattern);
});

test('slugify normalizes accents, spaces and casing into a url-safe slug', async () => {
  const { slugify } = await loadTypeScript('src/features/catalog/slug.ts');
  assert.equal(slugify('Cera de Coco'), 'cera-de-coco');
  assert.equal(slugify('Ácido Esteárico'), 'acido-estearico');
  assert.equal(slugify('Envases 100 ml'), 'envases-100-ml');
  assert.equal(slugify('  Envases   100 ml  '), 'envases-100-ml');
  assert.equal(slugify('cera de coco'), 'cera-de-coco');
  assert.equal(slugify('--Piña/Ñandú--'), 'pina-nandu');
  assert.doesNotMatch(slugify('Producto con  Espacios'), /\s/);
});

test('catalog mutations normalize product and category slugs through the shared helper before persisting', async () => {
  const mutations = await readFile(new URL('src/features/catalog/server/mutations.ts', root), 'utf8');
  assert.match(mutations, /import \{ slugify \} from '\.\.\/slug'/);
  assert.match(mutations, /slugify\(input\.slug\?\.trim\(\) \? input\.slug : input\.name\)/);
  const slugifyOnUpdateCount = (mutations.match(/const slug = slugify\(input\.slug\);/g) || []).length;
  assert.equal(slugifyOnUpdateCount, 2);
  assert.doesNotMatch(mutations, /slug: input\.slug\.trim\(\)/);
});

test('all migrated public catalog routes stay within the insumos foundation', async () => {
  const pages = await Promise.all([
    'src/app/page.tsx',
    'src/app/productos/page.tsx',
    'src/app/producto/[slug]/page.tsx',
    'src/app/categoria/[slug]/page.tsx',
    'src/app/carrito/page.tsx',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const catalogQueries = await readFile(new URL('src/features/catalog/server/queries.ts', root), 'utf8');
  const productDetail = await readFile(new URL('src/features/catalog/components/ProductDetail.tsx', root), 'utf8');
  const homeComponents = await Promise.all([
    'src/features/catalog/components/HomeCatalog.tsx',
    'src/features/catalog/components/home/Hero.tsx',
    'src/features/catalog/components/home/CategoryGrid.tsx',
    'src/features/catalog/components/home/FeaturedProducts.tsx',
    'src/features/catalog/components/home/TrustStrip.tsx',
    'src/features/catalog/components/home/categoryVisuals.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  for (const source of [...pages, catalogQueries, productDetail, ...homeComponents]) {
    assert.doesNotMatch(source, /@\/lib\/supabase|@\/lib\/woocommerce|supabaseServerUtils|productAdapter|ProductAdapter|NEXT_PUBLIC_SUPABASE/);
  }
  assert.match(pages[2], /getCatalogProductListing/);
  assert.match(pages[3], /getCatalogCategory/);
  assert.match(productDetail, /selectedVariantId/);
  assert.match(productDetail, /selectedVariant\.retailPrice/);
  // Public product detail limits/displays by availableStock, not raw
  // stockQuantity, since the inventory-reservations stage — see the
  // dedicated availableStock test below for the full rationale.
  assert.match(productDetail, /selectedVariant\.availableStock|selectedVariant\?\.availableStock/);
  assert.match(productDetail, /getProductMediaPublicUrl/);
});

test('the admin panel and its login gate render bare, without the legacy Artesellos chrome or the insumos storefront shell', async () => {
  const clientProviders = await readFile(new URL('src/components/ClientProviders.tsx', root), 'utf8');
  assert.match(clientProviders, /function isAdminRoute\(pathname: string\)/);
  assert.match(clientProviders, /pathname\.startsWith\('\/admin'\)/);
  assert.match(clientProviders, /pathname\.startsWith\('\/acceso-admin'\)/);
  assert.match(clientProviders, /const shell = admin \? \(\s*<>\{children\}<\/>/);
  const adminShell = await readFile(new URL('src/features/admin/components/AdminShell.tsx', root), 'utf8');
  assert.doesNotMatch(adminShell, /Artesellos|ChatInterface|FloatingWhatsApp/);
});

test('checkout rejects an empty cart and non-integer or zero/negative quantities', async () => {
  const { normalizeCheckoutItems } = await loadTypeScript('src/features/checkout/validation.ts');
  assert.throws(() => normalizeCheckoutItems([]), /vacío/);
  assert.throws(() => normalizeCheckoutItems(null));
  assert.throws(() => normalizeCheckoutItems('not-an-array'));
  const variantId = '11111111-1111-1111-1111-111111111111';
  assert.throws(() => normalizeCheckoutItems([{ variantId, quantity: 0 }]), /entero positivo/);
  assert.throws(() => normalizeCheckoutItems([{ variantId, quantity: -1 }]), /entero positivo/);
  assert.throws(() => normalizeCheckoutItems([{ variantId, quantity: 1.5 }]), /entero positivo/);
  assert.throws(() => normalizeCheckoutItems([{ variantId: 'not-a-uuid', quantity: 1 }]), /variante inválida/);
});

test('checkout rejects absurd quantities and merges duplicate variantId lines server-side before validating', async () => {
  const { normalizeCheckoutItems, MAX_ITEM_QUANTITY } = await loadTypeScript('src/features/checkout/validation.ts');
  const variantId = '11111111-1111-1111-1111-111111111111';
  assert.throws(() => normalizeCheckoutItems([{ variantId, quantity: MAX_ITEM_QUANTITY + 1 }]), /demasiado alta/);
  // A client (or a replayed/manipulated request) sending the same variant as
  // two fragments must be treated as one combined line, exactly like the
  // client cart reducer's own merge — the server never assumes the caller
  // already merged correctly.
  const merged = normalizeCheckoutItems([{ variantId, quantity: 2 }, { variantId, quantity: 3 }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].quantity, 5);
  // Splitting a quantity across fragments must not evade the absurd-quantity cap either.
  assert.throws(() => normalizeCheckoutItems([{ variantId, quantity: MAX_ITEM_QUANTITY }, { variantId, quantity: 1 }]), /demasiado alta/);
});

test('checkout requires complete buyer and shipping data with a real email and bounded text lengths', async () => {
  const { assertValidCustomer } = await loadTypeScript('src/features/checkout/validation.ts');
  const validAddress = { region: 'Metropolitana', comuna: 'Santiago', address: 'Calle Falsa', number: '123' };
  assert.throws(() => assertValidCustomer(null), /obligatorios/);
  assert.throws(() => assertValidCustomer({ fullName: '', email: 'a@b.com', phone: '+56911111111', shippingAddress: validAddress }), /nombre/);
  assert.throws(() => assertValidCustomer({ fullName: 'Test Client TEST', email: 'not-an-email', phone: '+56911111111', shippingAddress: validAddress }), /email no es válido/);
  assert.throws(() => assertValidCustomer({ fullName: 'Test Client TEST', email: 'a@b.com', phone: '+56911111111', shippingAddress: { ...validAddress, comuna: '' } }), /comuna/);
  assert.throws(() => assertValidCustomer({ fullName: 'a'.repeat(200), email: 'a@b.com', phone: '+56911111111', shippingAddress: validAddress }), /demasiado largo/);
  const ok = assertValidCustomer({ fullName: ' Test Client TEST ', email: ' a@b.com ', phone: '+56911111111', shippingAddress: validAddress, deliveryNotes: '  ' });
  assert.equal(ok.fullName, 'Test Client TEST');
  assert.equal(ok.deliveryNotes, null);
});

test('the checkout item contract never carries price, name or stock — only variantId and quantity leave the browser', async () => {
  const types = await readFile(new URL('src/features/checkout/types.ts', root), 'utf8');
  const itemInterface = types.match(/export interface CheckoutItemInput \{[\s\S]*?\}/)[0];
  assert.doesNotMatch(itemInterface, /price|Price|stock|Stock|name|Name|sku|Sku/);
  assert.match(itemInterface, /variantId/);
  assert.match(itemInterface, /quantity/);
});

test('the checkout mutation calls the session-aware client so auth.uid() can link a logged-in buyer, never the admin client', async () => {
  const mutations = await readFile(new URL('src/features/checkout/server/mutations.ts', root), 'utf8');
  assert.match(mutations, /createInsumosSupabaseServer\(\)/);
  assert.doesNotMatch(mutations, /createInsumosSupabaseAdmin/);
  assert.match(mutations, /create_pending_order/);
});

test('checkout error messages are allowlisted: unrecognized Supabase/Postgrest errors never reach the customer verbatim', async () => {
  const mutations = await readFile(new URL('src/features/checkout/server/mutations.ts', root), 'utf8');
  assert.match(mutations, /KNOWN_MESSAGE_PATTERNS/);
  assert.match(mutations, /some\(\(pattern\) => pattern\.test\(raw\)\)/);
  assert.match(mutations, /No pudimos crear tu pedido\. Intenta nuevamente\./);
});

test('the checkout route validates the payload before ever calling the order mutation, and never trusts a client-sent price', async () => {
  const route = await readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8');
  assert.match(route, /assertValidCheckoutPayload/);
  assert.match(route, /createPendingOrder/);
  const validateIndex = route.indexOf('assertValidCheckoutPayload(body)');
  const createIndex = route.indexOf('createPendingOrder(payload)');
  assert.ok(validateIndex >= 0 && createIndex > validateIndex, 'validation must run before order creation');
});

test('the checkout page only clears the cart after the server confirms the order was created, never before or on failure', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  const okCheckIndex = page.indexOf('if (!response.ok)');
  const clearCartCallIndex = page.indexOf('clearCart();');
  assert.ok(okCheckIndex >= 0 && clearCartCallIndex > okCheckIndex, 'clearCart() must be reachable only after the ok-check, i.e. after a real success response');
  assert.match(page, /router\.push\(`\/pedido\/\$\{data\.orderId\}\/confirmacion\?token=/);
});

test('the checkout page does not bounce a just-placed order back to /carrito via its own empty-cart guard', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /orderPlaced/);
  assert.match(page, /items\.length === 0 && !orderPlaced/);
  const setOrderPlacedIndex = page.indexOf('setOrderPlaced(true)');
  const clearCartCallIndex = page.indexOf('clearCart();');
  assert.ok(setOrderPlacedIndex >= 0 && setOrderPlacedIndex < clearCartCallIndex, 'orderPlaced must be set before clearCart() triggers the re-render race');
});

test('the order confirmation page requires a token and never renders payment-success language before a payment provider exists', async () => {
  const confirmation = await readFile(new URL('src/app/pedido/[id]/confirmacion/page.tsx', root), 'utf8');
  assert.match(confirmation, /searchParams/);
  assert.match(confirmation, /if \(!token\) notFound\(\);/);
  assert.match(confirmation, /getOrderConfirmation\(id, token\)/);
  assert.doesNotMatch(confirmation, /Pago exitoso|pago exitoso|Payment successful/);
});

test('order confirmation reads are gated by a random confirmation_token, not by the order id alone, through the service-role client', async () => {
  const queries = await readFile(new URL('src/features/checkout/server/queries.ts', root), 'utf8');
  assert.match(queries, /createInsumosSupabaseAdmin\(\)/);
  assert.match(queries, /\.eq\('confirmation_token', token\)/);
  const sql = await readFile(checkoutMigrationPath, 'utf8');
  assert.match(sql, /add column if not exists confirmation_token/);
  assert.match(sql, /gen_random_bytes\(24\)/);
});

test('order confirmation lookup fails safe to null (404) on any query error instead of crashing or leaking a stack trace', async () => {
  const queries = await readFile(new URL('src/features/checkout/server/queries.ts', root), 'utf8');
  assert.match(queries, /export async function getOrderConfirmation[\s\S]*?try \{[\s\S]*?catch \(error\) \{[\s\S]*?return null;/);
});

test('create_pending_order revalidates every item against the live catalog and never trusts client-supplied price or names', async () => {
  const sql = await readFile(checkoutFixMigrationPath, 'utf8');
  assert.match(sql, /create or replace function public\.create_pending_order/);
  assert.match(sql, /security definer/);
  assert.match(sql, /for update of pv/);
  // Existence can't be checked via a left-join null (Postgres rejects `for
  // update` on the nullable side of an outer join), so the join is inner
  // and a missing variant is instead detected by comparing matched vs
  // requested counts after the loop.
  assert.match(sql, /join public\.product_variants pv on pv\.id = m\.variant_id/);
  assert.doesNotMatch(sql, /left join public\.product_variants/);
  assert.match(sql, /v_matched_count < v_merged_count/);
  assert.match(sql, /not rec\.is_active/);
  assert.match(sql, /rec\.product_status <> 'active'/);
  assert.match(sql, /rec\.quantity < rec\.min_quantity/);
  assert.match(sql, /rec\.max_quantity is not null and rec\.quantity > rec\.max_quantity/);
  assert.match(sql, /rec\.quantity > rec\.stock_quantity/);
  // subtotal/line totals are computed only from the re-fetched retail_price, never from p_items
  assert.match(sql, /rec\.retail_price \* rec\.quantity/);
  assert.doesNotMatch(sql, /item->>'unitPrice'|item->>'price'|item->>'productName'/);
});

test('create_pending_order calls gen_random_bytes schema-qualified, since pgcrypto lives outside the function\'s restricted search_path', async () => {
  const sql = await readFile(checkoutFixMigrationPath, 'utf8');
  assert.match(sql, /extensions\.gen_random_bytes\(24\)/);
  assert.doesNotMatch(sql, /[^.]gen_random_bytes\(24\)/);
});

test('create_pending_order merges duplicate variantId entries by summed quantity before validating stock', async () => {
  const sql = await readFile(checkoutFixMigrationPath, 'utf8');
  assert.match(sql, /group by \(item->>'variantId'\)::uuid/);
  assert.match(sql, /sum\(\(item->>'quantity'\)::integer\)::integer as quantity/);
});

test('create_pending_order does not touch inventory: no stock_quantity write and no inventory_movements insert', async () => {
  for (const path of [checkoutMigrationPath, checkoutFixMigrationPath]) {
    const sql = await readFile(path, 'utf8');
    const fnMatch = sql.match(/create or replace function public\.create_pending_order[\s\S]*?\n\$\$;/);
    assert.ok(fnMatch, `create_pending_order function not found in ${path}`);
    const fnBody = fnMatch[0];
    assert.doesNotMatch(fnBody, /update public\.product_variants set stock_quantity/);
    assert.doesNotMatch(fnBody, /insert into public\.inventory_movements/);
  }
});

test('guest checkout is supported: customer_id is written from auth.uid() (null for anonymous buyers), no login is required', async () => {
  const sql = await readFile(checkoutFixMigrationPath, 'utf8');
  assert.match(sql, /insert into public\.orders \([\s\S]*?customer_id/);
  assert.match(sql, /auth\.uid\(\), trim\(p_customer_email\)/);
});

test('the checkout migration history is preserved, not rewritten: the original applied migration keeps its known bugs, fixed only by a separate follow-up migration', async () => {
  const original = await readFile(checkoutMigrationPath, 'utf8');
  const fix = await readFile(checkoutFixMigrationPath, 'utf8');
  // The originally-applied file must remain exactly as it was first run against
  // production — bugs included — so a fresh project replaying both migrations
  // in order reproduces the same schema history, not a silently rewritten one.
  assert.match(original, /left join public\.product_variants pv on pv\.id = m\.variant_id/);
  assert.match(original, /rec\.v_id is null or not rec\.is_active/);
  assert.doesNotMatch(original, /extensions\.gen_random_bytes/);
  // The fix migration only replaces the function — it must not redeclare the
  // column/index that the first migration already created.
  assert.doesNotMatch(fix, /add column if not exists confirmation_token/);
  assert.doesNotMatch(fix, /create unique index/);
  // Both migration filenames sort after the foundation migrations and in
  // the same relative order they were actually applied in production.
  assert.ok('20260831194938' > '20260831000300');
  assert.ok('20260831195354' > '20260831194938');
});

test('checkout and order confirmation stay isolated from legacy Artesellos checkout, cart and payment modules', async () => {
  const files = await Promise.all([
    'src/features/checkout/types.ts',
    'src/features/checkout/validation.ts',
    'src/features/checkout/server/mutations.ts',
    'src/features/checkout/server/queries.ts',
    'src/app/api/insumos/checkout/route.ts',
    'src/app/finalizar-compra/page.tsx',
    'src/app/finalizar-compra/layout.tsx',
    'src/app/pedido/[id]/confirmacion/page.tsx',
    'src/app/pedido/layout.tsx',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const legacyPattern = /@\/lib\/supabase|@\/lib\/woocommerce|@\/lib\/cartContext|@\/components\/wholesale|@\/app\/checkout|checkout\/mp|ProductAdapter|NEXT_PUBLIC_SUPABASE|Mercado ?Pago|mercadopago/i;
  for (const source of files) {
    assert.doesNotMatch(source, legacyPattern);
  }
});

test('the /carrito checkout CTA only renders when the cart has items, and links to the native checkout, never the legacy one', async () => {
  const cartPage = await readFile(new URL('src/app/carrito/page.tsx', root), 'utf8');
  const emptyStateIndex = cartPage.indexOf("items.length === 0");
  const ctaIndex = cartPage.indexOf('Continuar al checkout');
  assert.ok(emptyStateIndex >= 0 && ctaIndex > emptyStateIndex, 'the empty-cart early return must appear before the checkout CTA');
  assert.match(cartPage, /href="\/finalizar-compra"/);
});

// ============================================================================
// Inventory reservations: order/payment states, 15-minute holds, expiry,
// release, and reservation -> sale conversion. Mercado Pago is not connected;
// confirm_order_paid is a landing point for a future webhook only.
// ============================================================================

test('orders.status and orders.payment_status are locked down to the defined state sets', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  assert.match(sql, /check \(status in \('pending', 'awaiting_payment', 'paid', 'fulfilled', 'cancelled'\)\)/);
  assert.match(sql, /check \(payment_status in \('pending', 'approved', 'rejected', 'cancelled', 'refunded'\)\)/);
});

test('inventory_reservations table has the required fields, constraints and indexes', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  assert.match(sql, /create type public\.reservation_status as enum \('active', 'released', 'converted', 'expired'\)/);
  assert.match(sql, /create table if not exists public\.inventory_reservations/);
  assert.match(sql, /order_id uuid not null references public\.orders\(id\) on delete cascade/);
  assert.match(sql, /variant_id uuid not null references public\.product_variants\(id\) on delete restrict/);
  assert.match(sql, /quantity integer not null check \(quantity > 0\)/);
  assert.match(sql, /status public\.reservation_status not null default 'active'/);
  assert.match(sql, /expires_at timestamptz not null/);
  assert.match(sql, /inventory_reservations_order_id_idx/);
  assert.match(sql, /inventory_reservations_variant_id_idx/);
  assert.match(sql, /inventory_reservations_active_variant_idx[\s\S]*?where status = 'active'/);
  assert.match(sql, /inventory_reservations_active_expires_at_idx[\s\S]*?where status = 'active'/);
});

test('inventory_reservations has RLS enabled with no public read policy — buyers only reach it through the SECURITY DEFINER RPCs', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  assert.match(sql, /alter table public\.inventory_reservations enable row level security/);
  assert.match(sql, /catalog managers manage inventory reservations/);
  assert.doesNotMatch(sql, /create policy "[^"]*"\s*\n\s*on public\.inventory_reservations[\s\S]{0,200}using \(true\)/);
});

test('variant_available_stock: stock_quantity minus only active, unexpired reservations, exposed publicly as a derived number', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const viewMatch = sql.match(/create or replace view public\.variant_available_stock as[\s\S]*?;/);
  assert.ok(viewMatch, 'variant_available_stock view not found');
  const view = viewMatch[0];
  assert.match(view, /pv\.stock_quantity - coalesce\(r\.reserved_quantity, 0\) as available_stock/);
  // Reservations are only netted out while status = 'active' AND not yet
  // expired — released/converted/expired reservations (or an active one
  // whose time is already up) must not still count against availability.
  assert.match(view, /where status = 'active' and expires_at > now\(\)/);
  assert.match(sql, /grant select on public\.variant_available_stock to anon, authenticated;/);
});

test('reserve_order_inventory validates the order via confirmation_token, rejects paid/cancelled orders, and locks variants before checking available_stock', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.reserve_order_inventory[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'reserve_order_inventory not found');
  const fn = fnMatch[0];
  assert.match(fn, /v_order\.confirmation_token is null or v_order\.confirmation_token <> p_confirmation_token/);
  assert.match(fn, /v_order\.status in \('paid', 'fulfilled'\)/);
  assert.match(fn, /v_order\.status = 'cancelled'/);
  assert.match(fn, /for update of pv/);
  assert.match(fn, /rec\.quantity > rec\.available_stock/);
  assert.match(fn, /not rec\.is_active or rec\.product_status <> 'active'/);
});

test('reserve_order_inventory creates no reservation at all if any single item in a multi-item order falls short — no partial reservations', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.reserve_order_inventory[\s\S]*?\n\$\$;/);
  const fn = fnMatch[0];
  // The validation loop (which can raise and abort) must appear textually
  // before the insert — every item is checked before anything is written.
  const loopIndex = fn.indexOf('for rec in');
  const insertIndex = fn.indexOf('insert into public.inventory_reservations');
  assert.ok(loopIndex >= 0 && insertIndex > loopIndex, 'validation loop must run before any reservation is inserted');
  // One INSERT ... SELECT over every order_items row — either all rows are
  // written in the same statement or none are (no per-item insert inside
  // the validation loop that could partially commit).
  assert.doesNotMatch(fn.slice(loopIndex, insertIndex), /insert into public\.inventory_reservations/);
});

test('reserve_order_inventory is idempotent: a second call while an active, unexpired reservation exists reuses it and does not extend expires_at', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.reserve_order_inventory[\s\S]*?\n\$\$;/);
  const fn = fnMatch[0];
  const reuseMatch = fn.match(/if exists \([\s\S]*?status = 'active' and expires_at > now\(\)[\s\S]*?\) then\s*return query[\s\S]*?return;\s*end if;/);
  assert.ok(reuseMatch, 'idempotent reuse branch not found');
  assert.doesNotMatch(reuseMatch[0], /update public\.inventory_reservations set expires_at/);
  assert.doesNotMatch(reuseMatch[0], /v_expires_at :=/);
});

test('create_pending_order now validates available_stock (net of other active reservations), not raw stock_quantity, while still never reserving anything itself', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.create_pending_order[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'updated create_pending_order not found');
  const fn = fnMatch[0];
  assert.match(fn, /pv\.stock_quantity - coalesce\(\(\s*select sum\(r\.quantity\) from public\.inventory_reservations r/);
  assert.match(fn, /rec\.quantity > rec\.available_stock/);
  assert.doesNotMatch(fn, /insert into public\.inventory_reservations/);
  assert.doesNotMatch(fn, /status = 'awaiting_payment'/);
});

test('expire_inventory_reservations only touches active, past-due reservations, never modifies stock_quantity, and never cancels an order already paid/fulfilled', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.expire_inventory_reservations[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'expire_inventory_reservations not found');
  const fn = fnMatch[0];
  assert.match(fn, /where status = 'active' and expires_at <= now\(\)/);
  assert.match(fn, /set status = 'expired'/);
  assert.match(fn, /set status = 'cancelled', payment_status = 'cancelled'[\s\S]*?where id = rec\.order_id and status not in \('paid', 'fulfilled'\)/);
  assert.doesNotMatch(fn, /set stock_quantity/);
  assert.doesNotMatch(fn, /insert into public\.inventory_movements/);
});

test('expire_inventory_reservations and confirm_order_paid are restricted to service_role — never callable by anon or authenticated', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  for (const fn of ['expire_inventory_reservations()', 'confirm_order_paid(uuid)']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn.replace(/[()]/g, '\\$&')} from public;`));
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn.replace(/[()]/g, '\\$&')} from anon;`));
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn.replace(/[()]/g, '\\$&')} from authenticated;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn.replace(/[()]/g, '\\$&')} to service_role;`));
  }
});

test('release_order_inventory only releases active reservations, is proof-gated by confirmation_token, never touches converted reservations or stock_quantity, and refuses a paid order', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.release_order_inventory[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'release_order_inventory not found');
  const fn = fnMatch[0];
  assert.match(fn, /v_order\.confirmation_token is null or v_order\.confirmation_token <> p_confirmation_token/);
  assert.match(fn, /v_order\.status in \('paid', 'fulfilled'\)/);
  assert.match(fn, /where order_id = p_order_id and status = 'active'/);
  assert.match(fn, /set status = 'released', released_at = now\(\)/);
  assert.doesNotMatch(fn, /set stock_quantity/);
  // Deliberately does not touch order.status/payment_status — a future
  // reject/cancel flow decides the order's fate, not this primitive.
  assert.doesNotMatch(fn, /update public\.orders set status/);
  assert.match(sql, /grant execute on function public\.release_order_inventory\(uuid, text, text\) to anon, authenticated;/);
});

test('confirm_order_paid is idempotent: a second confirmation for an already-paid order returns early without decrementing stock or creating a second movement', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.confirm_order_paid[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'confirm_order_paid not found');
  const fn = fnMatch[0];
  const earlyReturnIndex = fn.indexOf("if v_order.status = 'paid' then");
  const decrementIndex = fn.indexOf('set stock_quantity = stock_quantity -');
  assert.ok(earlyReturnIndex >= 0 && decrementIndex > earlyReturnIndex, 'the already-paid early return must appear before the stock decrement');
  // The 4th column of the RETURNS TABLE is already_confirmed — this branch
  // returns `true` for it, the fresh-conversion path at the end returns `false`.
  assert.match(fn.slice(earlyReturnIndex, earlyReturnIndex + 200), /select v_order\.id, v_order\.status, v_order\.payment_status, true;/);
  assert.match(fn, /select p_order_id, 'paid'::text, 'approved'::text, false;/);
  // Locking the order row itself (`select ... for update`) is what makes a
  // second, concurrent call see status = 'paid' and take this branch
  // instead of racing the decrement — no separate uniqueness constraint
  // is needed for idempotency.
  assert.match(fn, /select \* into v_order from public\.orders where id = p_order_id for update/);
});

test('confirm_order_paid requires a still-active, unexpired reservation, decrements stock exactly once per variant, writes exactly one sale movement per variant, and converts (never releases/expires) the reservation', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.confirm_order_paid[\s\S]*?\n\$\$;/);
  const fn = fnMatch[0];
  assert.match(fn, /status = 'active' and expires_at > now\(\)/);
  // Locks BOTH the reservation row and the variant row — locking only pv
  // (as an earlier draft did) left a race window where a concurrent
  // expire_inventory_reservations sweep could expire this exact reservation
  // between the pre-check and the stock decrement; see the in-loop recheck.
  assert.match(fn, /for update of r, pv/);
  assert.match(fn, /rec\.reservation_status <> 'active' or rec\.reservation_expires_at <= now\(\)/);
  assert.match(fn, /v_reservation_count <> v_item_count/);
  assert.match(fn, /set stock_quantity = stock_quantity - rec\.quantity/);
  assert.match(fn, /'sale', -rec\.quantity/);
  assert.match(fn, /set status = 'converted', converted_at = now\(\)/);
  assert.match(fn, /set status = 'paid', payment_status = 'approved'/);
  // created_by is nullable on inventory_movements (verified against the
  // foundation migration) — a system/webhook-originated movement has no
  // authenticated user to attribute it to.
  assert.match(fn, /created_by\s*\n\s*\) values \([\s\S]*?, null\s*\n\s*\);/);
});

test('confirm_order_paid is race-safe against a concurrent expiry sweep: locking the reservation row itself (not just the variant) means it always sees the sweep\'s real outcome instead of silently overwriting it', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.confirm_order_paid[\s\S]*?\n\$\$;/);
  const fn = fnMatch[0];
  // The recheck must happen inside the FOR UPDATE loop, after the lock is
  // acquired — not only in the earlier count-based pre-check, which runs
  // before any lock is held and so cannot be race-safe on its own.
  const lockIndex = fn.indexOf('for update of r, pv');
  const recheckIndex = fn.indexOf("rec.reservation_status <> 'active' or rec.reservation_expires_at <= now()");
  const decrementIndex = fn.indexOf('set stock_quantity = stock_quantity -');
  assert.ok(lockIndex >= 0 && recheckIndex > lockIndex && decrementIndex > recheckIndex,
    'lock -> recheck-under-lock -> decrement must appear in that order');
});

test('a reservation is never both a physical stock decrement and a sale decrement: only confirm_order_paid touches stock_quantity, reserve/release/expire never do', async () => {
  for (const path of [reservationsMigrationPath]) {
    const sql = await readFile(path, 'utf8');
    for (const name of ['reserve_order_inventory', 'release_order_inventory', 'expire_inventory_reservations']) {
      const fnMatch = sql.match(new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\n\\$\\$;`));
      assert.ok(fnMatch, `${name} not found`);
      assert.doesNotMatch(fnMatch[0], /set stock_quantity/);
    }
  }
});

test('reservation/checkout functions lock variant rows before validating (FOR UPDATE), so a concurrent order cannot oversell the same variant', async () => {
  const sql = await readFile(reservationsMigrationPath, 'utf8');
  // confirm_order_paid additionally locks the reservation row itself (`r`) —
  // see the dedicated race-safety test above for why `pv` alone isn't enough there.
  const lockingFunctions = { reserve_order_inventory: /for update of pv/, confirm_order_paid: /for update of r, pv/, create_pending_order: /for update of pv/ };
  for (const [name, pattern] of Object.entries(lockingFunctions)) {
    const fnMatch = sql.match(new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\n\\$\\$;`));
    assert.ok(fnMatch, `${name} not found`);
    assert.match(fnMatch[0], pattern, `${name} must lock its rows`);
  }
});

test('the catalog layer exposes availableStock (physical stock minus active reservations) alongside stockQuantity, and the public storefront uses it — not the admin panel', async () => {
  const types = await readFile(new URL('src/features/catalog/types.ts', root), 'utf8');
  assert.match(types, /availableStock: number/);
  assert.match(types, /stockQuantity: number/);

  const queries = await readFile(new URL('src/features/catalog/server/queries.ts', root), 'utf8');
  assert.match(queries, /variant_available_stock/);
  assert.match(queries, /fetchAvailableStockByVariantId/);

  const card = await readFile(new URL('src/features/catalog/components/ProductCard.tsx', root), 'utf8');
  assert.match(card, /variant\.availableStock > 0/);
  assert.doesNotMatch(card, /variant\.stockQuantity/);

  const detail = await readFile(new URL('src/features/catalog/components/ProductDetail.tsx', root), 'utf8');
  assert.match(detail, /selectedVariant\?\.availableStock/);
  assert.match(detail, /stockAvailable: selectedVariant\.availableStock/);
  assert.doesNotMatch(detail, /selectedVariant\.stockQuantity|selectedVariant\?\.stockQuantity/);

  // Admin's inventory management must keep showing/editing physical stock —
  // this stage does not touch the admin panel.
  const editor = await readFile(new URL('src/features/admin/components/ProductEditor.tsx', root), 'utf8');
  assert.match(editor, /stockQuantity/);
});

test('the original reservations migration is preserved with its real applied bug: bare column references that collide with RETURNS TABLE output columns, fixed only by a separate follow-up migration', async () => {
  const original = await readFile(reservationsMigrationPath, 'utf8');
  const fix = await readFile(reservationsFixMigrationPath, 'utf8');
  // reserve_order_inventory's RETURNS TABLE declares an `expires_at` output
  // column; PL/pgSQL treats it as an implicitly-declared variable for the
  // whole function body, so this bare reference (no table alias) is exactly
  // the ambiguity that made every call fail on first live use — preserved
  // here unqualified, matching what was actually first applied.
  assert.match(original, /select 1 from public\.inventory_reservations\s*\n\s*where order_id = p_order_id and status = 'active' and expires_at > now\(\)/);
  // confirm_order_paid's RETURNS TABLE declares order_id/status output
  // columns; same class of bug, also preserved unqualified here.
  assert.match(original, /select count\(\*\) into v_item_count from public\.order_items where order_id = p_order_id;/);
  assert.match(original, /where order_id = p_order_id and status = 'active' and expires_at > now\(\);/);

  // The fix migration only replaces the two affected functions — it must
  // not redeclare the table/index/view/other functions the first migration
  // already created.
  assert.doesNotMatch(fix, /create table if not exists public\.inventory_reservations/);
  assert.doesNotMatch(fix, /create or replace view public\.variant_available_stock/);
  assert.doesNotMatch(fix, /create or replace function public\.release_order_inventory/);
  assert.doesNotMatch(fix, /create or replace function public\.expire_inventory_reservations/);
  assert.doesNotMatch(fix, /create or replace function public\.create_pending_order/);
});

test('the fix migration table-qualifies every reference that collided with a RETURNS TABLE output column name, in both affected functions', async () => {
  const fix = await readFile(reservationsFixMigrationPath, 'utf8');
  const reserveMatch = fix.match(/create or replace function public\.reserve_order_inventory[\s\S]*?\n\$\$;/);
  assert.ok(reserveMatch, 'reserve_order_inventory not found in fix migration');
  assert.match(reserveMatch[0], /select 1 from public\.inventory_reservations ir\s*\n\s*where ir\.order_id = p_order_id and ir\.status = 'active' and ir\.expires_at > now\(\)/);

  const confirmMatch = fix.match(/create or replace function public\.confirm_order_paid[\s\S]*?\n\$\$;/);
  assert.ok(confirmMatch, 'confirm_order_paid not found in fix migration');
  assert.match(confirmMatch[0], /from public\.order_items oi where oi\.order_id = p_order_id/);
  assert.match(confirmMatch[0], /from public\.inventory_reservations ir\s*\n\s*where ir\.order_id = p_order_id and ir\.status = 'active' and ir\.expires_at > now\(\)/);
  // The race-safety fix from the previous round (locking the reservation
  // row itself, not just the variant) must survive this fix untouched.
  assert.match(confirmMatch[0], /for update of r, pv/);
});
