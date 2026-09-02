import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
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
// Placeholder filename, not applied yet — will be renamed to match whatever
// version Supabase actually assigns once approved and applied, same as
// every migration before it in this feature.
const checkoutV2MigrationPath = new URL('supabase/migrations/20260831225244_insumos_checkout_v2_shipping_billing.sql', root);
// Placeholder filename, not applied yet — same rename-after-apply pattern.
const checkoutV21MigrationPath = new URL('supabase/migrations/20260901000549_insumos_checkout_v21_delivery_validation.sql', root);
// Placeholder filename, not applied yet — same rename-after-apply pattern.
const emailDeliveriesMigrationPath = new URL('supabase/migrations/20260901135015_insumos_email_deliveries.sql', root);
// Placeholder filename, not applied yet — same rename-after-apply pattern.
const paymentPreferenceMigrationPath = new URL('supabase/migrations/20260901150511_insumos_payment_preference_columns.sql', root);
// Placeholder filename, not applied yet — same rename-after-apply pattern.
const releasePaymentReservationMigrationPath = new URL('supabase/migrations/20260901154539_insumos_release_order_payment_reservation.sql', root);
// Placeholder filename, not applied yet — same rename-after-apply pattern.
const confirmOrderPaymentReferenceMigrationPath = new URL('supabase/migrations/20260901231742_insumos_confirm_order_payment_reference.sql', root);
const customersMigrationPath = new URL('supabase/migrations/20260902170527_insumos_customers.sql', root);
const checkoutCustomerIdentityMigrationPath = new URL('supabase/migrations/20260902174015_insumos_checkout_customer_identity.sql', root);
const customerAuthClaimMigrationPath = new URL('supabase/migrations/20260902181251_insumos_customer_auth_claim.sql', root);
const buyerRlsMigrationPath = new URL('supabase/migrations/20260902183705_insumos_buyer_rls.sql', root);

// Transpiles and executes a TS module in an isolated vm context — not a
// real module system, so relative `import`s that survive transpilation
// (i.e. anything that isn't type-only) become `require(...)` calls this
// sandbox must resolve itself. moduleCache both makes that recursion work
// and avoids re-transpiling a shared dependency (e.g. shipping.ts) once per
// importer.
const moduleCache = new Map();

function loadModuleSync(fileUrl) {
  if (moduleCache.has(fileUrl.href)) return moduleCache.get(fileUrl.href);
  const source = readFileSync(fileUrl, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const outputModule = { exports: {} };
  moduleCache.set(fileUrl.href, outputModule.exports);
  const sandbox = {
    module: outputModule,
    exports: outputModule.exports,
    require: (specifier) => {
      if (!specifier.startsWith('.')) {
        throw new Error(`Test sandbox cannot resolve non-relative import "${specifier}" (from ${fileUrl.pathname})`);
      }
      const candidate = specifier.endsWith('.ts') ? specifier : `${specifier}.ts`;
      return loadModuleSync(new URL(candidate, fileUrl));
    },
  };
  vm.runInNewContext(compiled, sandbox);
  return outputModule.exports;
}

async function loadTypeScript(relativePath) {
  return loadModuleSync(new URL(relativePath, root));
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
  const validAddress = { region: 'Región Metropolitana de Santiago', comuna: 'Santiago', address: 'Calle Falsa', number: '123' };
  const base = { phone: '+56911111111', shippingAddress: validAddress, preferredCarrier: 'starken' };
  assert.throws(() => assertValidCustomer(null), /obligatorios/);
  assert.throws(() => assertValidCustomer({ ...base, fullName: '', email: 'a@b.com' }), /nombre/);
  assert.throws(() => assertValidCustomer({ ...base, fullName: 'Test Client TEST', email: 'not-an-email' }), /correo electrónico válido/);
  assert.throws(() => assertValidCustomer({ ...base, fullName: 'Test Client TEST', email: 'a@b.com', shippingAddress: { ...validAddress, comuna: '' } }), /comuna/);
  assert.throws(() => assertValidCustomer({ ...base, fullName: 'a'.repeat(200), email: 'a@b.com' }), /demasiado largo/);
  const ok = assertValidCustomer({ ...base, fullName: ' Test Client TEST ', email: ' a@b.com ', deliveryNotes: '  ' });
  assert.equal(ok.fullName, 'Test Client TEST');
  assert.equal(ok.deliveryNotes, null);
  assert.equal(ok.billingDocumentType, 'boleta');
  assert.equal(ok.billingData, null);
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

test('the checkout page only clears the cart after the server confirms order + reservation + payment preference all succeeded (a single 2xx response), never before or on failure', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  const okCheckIndex = page.indexOf('if (!response.ok)');
  const clearCartCallIndex = page.indexOf('clearCart();');
  assert.ok(okCheckIndex >= 0 && clearCartCallIndex > okCheckIndex, 'clearCart() must be reachable only after the ok-check, i.e. after a real success response');
  assert.match(page, /window\.location\.href = data\.paymentUrl;/);
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

// ============================================================================
// Checkout V2: free-shipping threshold, region/comuna cascading selects,
// carrier preference, boleta/factura with billing data. Mercado Pago,
// transport-carrier APIs and electronic invoicing stay out of scope.
// ============================================================================

test('region/comuna dataset: every region has comunas, and the required cross-checks resolve to the right region', async () => {
  const { CHILE_REGIONS, isValidRegion, isValidRegionComuna } = await loadTypeScript('src/features/checkout/regionComuna.ts');
  assert.equal(CHILE_REGIONS.length, 16);
  for (const region of CHILE_REGIONS) {
    assert.ok(region.comunas.length > 0, `${region.name} has no comunas`);
  }
  assert.ok(isValidRegion('Región del Biobío'));
  assert.ok(isValidRegionComuna('Región del Biobío', 'Coronel'));
  assert.ok(isValidRegionComuna('Región del Biobío', 'Concepción'));
  assert.ok(isValidRegionComuna('Región Metropolitana de Santiago', 'Santiago'));
  assert.ok(isValidRegionComuna('Región de Magallanes y de la Antártica Chilena', 'Punta Arenas'));
  // Cross-checks: these comunas must NOT resolve under the wrong region.
  assert.equal(isValidRegionComuna('Región Metropolitana de Santiago', 'Coronel'), false);
  assert.equal(isValidRegionComuna('Región del Biobío', 'Santiago'), false);
  assert.equal(isValidRegion('Región Inventada'), false);
});

test('region/comuna dataset: every comuna belongs to exactly one region across the whole dataset (346 total, no duplicates)', async () => {
  const { CHILE_REGIONS } = await loadTypeScript('src/features/checkout/regionComuna.ts');
  const seen = new Map();
  for (const region of CHILE_REGIONS) {
    for (const comuna of region.comunas) {
      assert.ok(!seen.has(comuna), `comuna "${comuna}" appears under both "${seen.get(comuna)}" and "${region.name}"`);
      seen.set(comuna, region.name);
    }
  }
  assert.equal(seen.size, 346);
});

test('RUT validation: accepts dotted/undotted/dashless formats that share a valid check digit, and rejects a wrong check digit or garbage', async () => {
  const { isValidRut, normalizeRut, formatRut } = await loadTypeScript('src/features/checkout/rut.ts');
  assert.equal(isValidRut('12.345.678-5'), true);
  assert.equal(isValidRut('12345678-5'), true);
  assert.equal(isValidRut('123456785'), true);
  assert.equal(isValidRut('11.111.111-1'), true);
  assert.equal(isValidRut('11.111.111-2'), false);
  assert.equal(isValidRut('abc'), false);
  assert.equal(isValidRut(''), false);
  assert.equal(normalizeRut('12.345.678-5'), '123456785');
  assert.equal(formatRut('123456785'), '12.345.678-5');
});

test('shipping policy boundary: 49999 is receiver_pays, exactly 50000 and 50001 are both free', async () => {
  const { computeShippingPolicy, amountUntilFreeShipping, FREE_SHIPPING_THRESHOLD } = await loadTypeScript('src/features/checkout/shipping.ts');
  assert.equal(FREE_SHIPPING_THRESHOLD, 50000);
  assert.equal(computeShippingPolicy(49999), 'receiver_pays');
  assert.equal(computeShippingPolicy(50000), 'free');
  assert.equal(computeShippingPolicy(50001), 'free');
  assert.equal(amountUntilFreeShipping(32500), 17500);
  assert.equal(amountUntilFreeShipping(50000), 0);
  assert.equal(amountUntilFreeShipping(60000), 0);
});

test('carrier and billing-document-type allowlists reject anything outside their fixed sets', async () => {
  const { isValidCarrier, isValidBillingDocumentType, PREFERRED_CARRIERS, BILLING_DOCUMENT_TYPES } = await loadTypeScript('src/features/checkout/shipping.ts');
  // Spread into a plain array first: PREFERRED_CARRIERS/BILLING_DOCUMENT_TYPES
  // come from the vm-sandboxed module (a separate realm), and deepEqual
  // considers cross-realm arrays unequal by prototype even with identical
  // contents — materializing a main-realm copy sidesteps that.
  assert.deepEqual([...PREFERRED_CARRIERS], ['starken', 'chilexpress', 'blue_express']);
  assert.deepEqual([...BILLING_DOCUMENT_TYPES], ['boleta', 'factura']);
  for (const carrier of PREFERRED_CARRIERS) assert.equal(isValidCarrier(carrier), true);
  assert.equal(isValidCarrier('correos-de-chile'), false);
  assert.equal(isValidCarrier(undefined), false);
  for (const docType of BILLING_DOCUMENT_TYPES) assert.equal(isValidBillingDocumentType(docType), true);
  assert.equal(isValidBillingDocumentType('invoice'), false);
});

test('checkout rejects an invalid carrier, an unknown region, and a comuna that does not belong to the given region', async () => {
  const { assertValidCustomer } = await loadTypeScript('src/features/checkout/validation.ts');
  const validAddress = { region: 'Región Metropolitana de Santiago', comuna: 'Santiago', address: 'Calle Falsa', number: '123' };
  const base = { fullName: 'Test Client', email: 'a@b.com', phone: '+56911111111', shippingAddress: validAddress };
  assert.throws(() => assertValidCustomer({ ...base, preferredCarrier: 'correos-de-chile' }), /transportista/);
  assert.throws(() => assertValidCustomer({ ...base, preferredCarrier: undefined }), /transportista/);
  assert.doesNotThrow(() => assertValidCustomer({ ...base, preferredCarrier: 'starken' }));

  assert.throws(() => assertValidCustomer({ ...base, preferredCarrier: 'starken', shippingAddress: { ...validAddress, region: 'Región Inventada' } }), /región no es válida/);
  assert.throws(() => assertValidCustomer({ ...base, preferredCarrier: 'starken', shippingAddress: { ...validAddress, comuna: 'Coronel' } }), /no pertenece a la región/);
});

test('checkout: boleta requires no business data; factura requires a valid RUT, razón social, giro and a valid billing region/comuna', async () => {
  const { assertValidCustomer } = await loadTypeScript('src/features/checkout/validation.ts');
  const validAddress = { region: 'Región Metropolitana de Santiago', comuna: 'Santiago', address: 'Calle Falsa', number: '123' };
  const base = { fullName: 'Test Client', email: 'a@b.com', phone: '+56911111111', shippingAddress: validAddress, preferredCarrier: 'starken' };

  const boleta = assertValidCustomer({ ...base, billingDocumentType: 'boleta' });
  assert.equal(boleta.billingData, null);

  const validBilling = {
    rut: '11.111.111-1', businessName: 'Mi Empresa SPA', businessActivity: 'Venta de insumos',
    email: 'facturacion@empresa.cl', region: 'Región Metropolitana de Santiago', comuna: 'Providencia', address: 'Av. Siempre Viva', number: '742',
  };

  assert.throws(() => assertValidCustomer({ ...base, billingDocumentType: 'factura' }), /facturación son obligatorios/);
  assert.throws(() => assertValidCustomer({ ...base, billingDocumentType: 'factura', billingData: { ...validBilling, rut: '11.111.111-2' } }), /RUT no es válido/);
  assert.throws(() => assertValidCustomer({ ...base, billingDocumentType: 'factura', billingData: { ...validBilling, businessName: '' } }), /razón social/);
  assert.throws(() => assertValidCustomer({ ...base, billingDocumentType: 'factura', billingData: { ...validBilling, businessActivity: '' } }), /giro/);
  assert.throws(() => assertValidCustomer({ ...base, billingDocumentType: 'factura', billingData: { ...validBilling, comuna: 'Coronel' } }), /Facturación/);

  const factura = assertValidCustomer({ ...base, billingDocumentType: 'factura', billingData: validBilling });
  assert.equal(factura.billingData.rut, '111111111');
  assert.equal(factura.billingData.businessName, 'Mi Empresa SPA');
});

test('cl_comunas seed table includes the required cross-checks (Coronel/Concepción → Biobío, Santiago → Metropolitana, Punta Arenas → Magallanes) and totals exactly 346 comunas', async () => {
  const sql = await readFile(checkoutV2MigrationPath, 'utf8');
  assert.match(sql, /create table if not exists public\.cl_comunas/);
  assert.match(sql, /comuna text primary key/);
  assert.match(sql, /\('Coronel', 'Región del Biobío'\)/);
  assert.match(sql, /\('Concepción', 'Región del Biobío'\)/);
  assert.match(sql, /\('Santiago', 'Región Metropolitana de Santiago'\)/);
  assert.match(sql, /\('Punta Arenas', 'Región de Magallanes y de la Antártica Chilena'\)/);
  const insertBlock = sql.match(/insert into public\.cl_comunas[\s\S]*?on conflict \(comuna\) do update set region = excluded\.region;/);
  assert.ok(insertBlock, 'cl_comunas seed insert not found');
  const rowCount = (insertBlock[0].match(/\(\s*'(?:[^']|'')*',\s*'(?:[^']|'')*'\s*\)/g) || []).length;
  assert.equal(rowCount, 346);
});

test('orders gains shipping_policy/preferred_carrier/billing_document_type as CHECK-constrained allowlists, and a table constraint keeps billing_data consistent with billing_document_type', async () => {
  const sql = await readFile(checkoutV2MigrationPath, 'utf8');
  assert.match(sql, /add column if not exists shipping_policy text not null default 'receiver_pays'/);
  assert.match(sql, /check \(shipping_policy in \('free', 'receiver_pays'\)\)/);
  assert.match(sql, /add column if not exists preferred_carrier text/);
  assert.match(sql, /check \(preferred_carrier is null or preferred_carrier in \('starken', 'chilexpress', 'blue_express'\)\)/);
  assert.match(sql, /add column if not exists billing_document_type text not null default 'boleta'/);
  assert.match(sql, /check \(billing_document_type in \('boleta', 'factura'\)\)/);
  assert.match(sql, /add column if not exists billing_data jsonb/);
  assert.match(sql, /add constraint orders_billing_data_matches_document_type/);
  assert.match(sql, /billing_document_type = 'boleta' and billing_data is null/);
  assert.match(sql, /billing_document_type = 'factura' and billing_data is not null/);
});

test('is_valid_rut (SQL) mirrors the TS check-digit algorithm: modulo 11, "K" for remainder 10, "0" for remainder 11', async () => {
  const sql = await readFile(checkoutV2MigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.is_valid_rut[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'is_valid_rut not found');
  const fn = fnMatch[0];
  assert.match(fn, /total := total \+ digit \* multiplier/);
  assert.match(fn, /remainder := 11 - \(total % 11\)/);
  assert.match(fn, /when remainder = 10 then 'K'/);
  assert.match(fn, /when remainder = 11 then '0'/);
});

test('create_pending_order (V2) computes shipping_policy only from the server-side subtotal — the RPC has no shipping_policy parameter for a client to manipulate — and validates carrier/billing/region against fixed allowlists and cl_comunas', async () => {
  const sql = await readFile(checkoutV2MigrationPath, 'utf8');
  assert.match(sql, /drop function if exists public\.create_pending_order\(jsonb, text, text, text, jsonb, text\);/);
  const fnMatch = sql.match(/create or replace function public\.create_pending_order[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'V2 create_pending_order not found');
  const fn = fnMatch[0];
  assert.match(fn, /v_shipping_policy := case when v_subtotal >= 50000 then 'free' else 'receiver_pays' end;/);
  assert.doesNotMatch(fn, /p_shipping_policy/);
  assert.match(fn, /p_preferred_carrier is null or p_preferred_carrier not in \('starken', 'chilexpress', 'blue_express'\)/);
  assert.match(fn, /v_billing_document_type not in \('boleta', 'factura'\)/);
  assert.match(fn, /not public\.is_valid_rut\(p_billing_data->>'rut'\)/);
  assert.match(fn, /from public\.cl_comunas\s*\n\s*where comuna = \(p_shipping_address->>'comuna'\)/);
  assert.match(fn, /from public\.cl_comunas\s*\n\s*where comuna = \(p_billing_data->>'comuna'\)/);
  assert.match(sql, /grant execute on function public\.create_pending_order\(jsonb, text, text, text, jsonb, text, text, text, jsonb\) to anon, authenticated;/);
});

test('create_pending_order (V2) keeps shipping_total at 0 and total equal to subtotal regardless of shipping policy', async () => {
  const sql = await readFile(checkoutV2MigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.create_pending_order[\s\S]*?\n\$\$;/);
  const fn = fnMatch[0];
  assert.match(fn, /subtotal, discount_total, shipping_total, total,/);
  assert.match(fn, /v_subtotal, 0, 0, v_subtotal,/);
});

test('the Checkout V2 migration stays out of scope: no Mercado Pago integration, no cron, no payment/preference id columns, no transport-carrier API endpoints, no electronic invoicing', async () => {
  const sql = await readFile(checkoutV2MigrationPath, 'utf8');
  // The migration's own header comment explains what's deliberately left
  // out (including the words "Mercado Pago") — that's documentation, not an
  // integration. Only the executable SQL statements matter here, so
  // comment lines are stripped before checking for real integration markers.
  const withoutComments = sql.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(withoutComments, /mercado ?pago|mercadopago/i);
  assert.doesNotMatch(sql, /pg_cron|cron\.schedule/i);
  assert.doesNotMatch(sql, /add column[\s\S]{0,40}(payment_id|preference_id)/i);
  assert.doesNotMatch(sql, /starken\.cl|chilexpress\.cl|blueexpress\.cl|https?:\/\//i);
  assert.doesNotMatch(sql, /documento tributario electrónico|\bdte\b/i);
});

test('order confirmation shows document type, preferred carrier label and the correct shipping-policy message, plus business name/RUT only when invoiced', async () => {
  const page = await readFile(new URL('src/app/pedido/[id]/confirmacion/page.tsx', root), 'utf8');
  assert.match(page, /order\.billingDocumentType/);
  assert.match(page, /CARRIER_LABELS\[order\.preferredCarrier\]/);
  assert.match(page, /order\.shippingPolicy === 'free' \? 'Envío gratis' : 'Envío por pagar'/);
  assert.match(page, /order\.billingDocumentType === 'factura' && order\.billingData/);
  assert.match(page, /formatRut\(order\.billingData\.rut\)/);
  assert.doesNotMatch(page, /Pago exitoso|pago exitoso/);
});

test('/carrito shows the free-shipping message below subtotal, computed from the shared shipping-policy helper (not a hardcoded threshold)', async () => {
  const page = await readFile(new URL('src/app/carrito/page.tsx', root), 'utf8');
  assert.match(page, /computeShippingPolicy\(subtotal\)/);
  assert.match(page, /Te faltan \{formatPrice\(remainderForFreeShipping\)\} para obtener envío gratis\./);
  assert.match(page, /¡Tienes envío gratis!/);
});

test('/finalizar-compra shows the correct free-shipping message and carrier disclaimer copy for both shipping policies', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /¡Tu pedido tiene envío gratis!/);
  assert.match(page, /Te faltan \{formatPrice\(remainderForFreeShipping\)\} para obtener envío gratis\./);
  assert.match(page, /despacha por pagar mediante el transportista/);
  assert.match(page, /Envío gratis mediante uno de nuestros transportistas disponibles/);
});

test('/finalizar-compra resets the selected comuna whenever región changes, and disables the comuna select until a región is chosen', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /function updateRegion\(region: string\) \{/);
  assert.match(page, /setForm\(\(current\) => \(\{ \.\.\.current, region, comuna: '' \}\)\)/);
  assert.match(page, /disabled=\{!form\.region\}/);
});

test('/finalizar-compra keeps billing address synced to shipping while "usar misma dirección" is checked, and stops syncing once unchecked', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /useSameAddressForBilling/);
  assert.match(page, /if \(!isShipping \|\| !form\.useSameAddressForBilling\) return;/);
  assert.match(page, /disabled=\{isShipping && form\.useSameAddressForBilling\}/);
});

test('checkout V2 modules (region/comuna, RUT, shipping policy) stay isolated from legacy Artesellos and never hardcode a payment/transport-carrier API endpoint', async () => {
  const files = await Promise.all([
    'src/features/checkout/regionComuna.ts',
    'src/features/checkout/rut.ts',
    'src/features/checkout/shipping.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const legacyPattern = /@\/lib\/supabase|@\/lib\/woocommerce|@\/lib\/cartContext|@\/app\/checkout|checkout\/mp|NEXT_PUBLIC_SUPABASE|Mercado ?Pago|mercadopago|starken\.cl|chilexpress\.cl|blueexpress|https?:\/\//i;
  for (const source of files) {
    assert.doesNotMatch(source, legacyPattern);
  }
});

// ==========================================================================
// Checkout V2.1: name/email/phone validation, villa/población/sector, and
// store_pickup as a second delivery method alongside shipping.
// ==========================================================================

test('full-name validation: accepts real Spanish names with accents/ñ/apostrophe/hyphen, rejects digits and symbols', async () => {
  const { isValidFullName, normalizeFullName } = await loadTypeScript('src/features/checkout/name.ts');
  assert.equal(isValidFullName('María José Pérez'), true);
  assert.equal(isValidFullName("José O'Neill"), true);
  assert.equal(isValidFullName('Ana-María Muñoz'), true);
  assert.equal(isValidFullName('Juan Carlos Gaete'), true);
  assert.equal(isValidFullName('524545545'), false);
  assert.equal(isValidFullName('Juan123'), false);
  assert.equal(isValidFullName('@@Pedro'), false);
  assert.equal(isValidFullName(''), false);
  assert.equal(isValidFullName('   '), false);
  assert.equal(isValidFullName('A'), false); // below MIN_FULL_NAME_LENGTH
  assert.equal(normalizeFullName('  Juan   Carlos   Gaete  '), 'Juan Carlos Gaete');
});

test('email validation: accepts a real address, rejects garbage/missing-domain/missing-TLD/space-separated inputs', async () => {
  const { isValidEmail, normalizeEmail } = await loadTypeScript('src/features/checkout/email.ts');
  assert.equal(isValidEmail('usuario@gmail.com'), true);
  assert.equal(isValidEmail('dsWADSadsa'), false);
  assert.equal(isValidEmail('usuario@'), false);
  assert.equal(isValidEmail('usuario@gmail'), false);
  assert.equal(isValidEmail('usuario gmail.com'), false);
  assert.equal(normalizeEmail('  Usuario@Gmail.COM  '), 'usuario@gmail.com');
});

test('Chilean mobile phone: normalizes national digits to +56 form, validates 9-digit mobile numbers starting with 9, rejects letters/wrong length/non-mobile', async () => {
  const { normalizeChileanMobile, isValidChileanMobile, sanitizeNationalDigits, extractDigits, CHILE_COUNTRY_CODE } = await loadTypeScript('src/features/checkout/phone.ts');
  assert.equal(CHILE_COUNTRY_CODE, '+56');
  assert.equal(normalizeChileanMobile('912345678'), '+56912345678');
  assert.equal(isValidChileanMobile('+56912345678'), true);
  assert.equal(isValidChileanMobile('+56812345678'), false); // doesn't start with 9
  assert.equal(isValidChileanMobile('+5691234567'), false); // 8 digits, too short
  assert.equal(isValidChileanMobile('+569123456789'), false); // 10 digits, too long
  assert.equal(isValidChileanMobile('+56abc345678'), false); // letters
  assert.equal(isValidChileanMobile('56912345678'), false); // missing '+'
  // Paste-safe: formatted/pasted input reduces to digits-only, capped at 9.
  assert.equal(sanitizeNationalDigits('9 1234 5678'), '912345678');
  assert.equal(sanitizeNationalDigits('abc9123456789xyz'), '912345678');
  assert.equal(extractDigits('+56 9 1234-5678'), '56912345678');
});

test('RUT fixtures: 76.123.456-0 and 11.111.111-1 are mathematically valid; 11.111.111-2 is not — no fixture is hardcoded as "looks fake, reject it"', async () => {
  const { isValidRut, normalizeRut } = await loadTypeScript('src/features/checkout/rut.ts');
  assert.equal(isValidRut('76.123.456-0'), true);
  assert.equal(isValidRut('76.123.456-6'), false); // wrong check digit for this body
  assert.equal(isValidRut('11.111.111-1'), true);
  assert.equal(isValidRut('11.111.111-2'), false);
  assert.equal(normalizeRut('76.123.456-0'), '761234560');
});

test('checkout: full name and email are validated against the real Unicode/format rules, not just non-empty', async () => {
  const { assertValidCustomer } = await loadTypeScript('src/features/checkout/validation.ts');
  const validAddress = { region: 'Región Metropolitana de Santiago', comuna: 'Santiago', address: 'Calle Falsa', number: '123' };
  const base = { email: 'a@b.com', phone: '+56912345678', shippingAddress: validAddress, preferredCarrier: 'starken' };

  assert.throws(() => assertValidCustomer({ ...base, fullName: 'Juan123' }), /nombre válido/);
  assert.throws(() => assertValidCustomer({ ...base, fullName: '524545545' }), /nombre válido/);
  assert.throws(() => assertValidCustomer({ ...base, fullName: '@@Pedro' }), /nombre válido/);
  assert.doesNotThrow(() => assertValidCustomer({ ...base, fullName: 'María José Pérez' }));
  assert.doesNotThrow(() => assertValidCustomer({ ...base, fullName: "José O'Neill" }));

  assert.throws(() => assertValidCustomer({ ...base, fullName: 'Juan Pérez', email: 'dsWADSadsa' }), /correo electrónico válido/);
  assert.throws(() => assertValidCustomer({ ...base, fullName: 'Juan Pérez', email: 'usuario@' }), /correo electrónico válido/);
  assert.throws(() => assertValidCustomer({ ...base, fullName: 'Juan Pérez', email: 'usuario@gmail' }), /correo electrónico válido/);
});

test('checkout: phone must be a valid +56 Chilean mobile — letters, wrong length and non-mobile numbers are all rejected server-side', async () => {
  const { assertValidCustomer } = await loadTypeScript('src/features/checkout/validation.ts');
  const validAddress = { region: 'Región Metropolitana de Santiago', comuna: 'Santiago', address: 'Calle Falsa', number: '123' };
  const base = { fullName: 'Juan Pérez', email: 'a@b.com', shippingAddress: validAddress, preferredCarrier: 'starken' };

  assert.throws(() => assertValidCustomer({ ...base, phone: '+56abcabcabc' }), /celular chileno válido/);
  assert.throws(() => assertValidCustomer({ ...base, phone: '+5691234567' }), /celular chileno válido/); // too short
  assert.throws(() => assertValidCustomer({ ...base, phone: '+56812345678' }), /celular chileno válido/); // landline-shaped, not mobile
  assert.doesNotThrow(() => assertValidCustomer({ ...base, phone: '+56912345678' }));
});

test('delivery method: shipping requires region/comuna/address/number/carrier; store_pickup requires none of them and leaves shippingAddress/preferredCarrier null', async () => {
  const { assertValidCustomer } = await loadTypeScript('src/features/checkout/validation.ts');
  const validAddress = { region: 'Región Metropolitana de Santiago', comuna: 'Santiago', address: 'Calle Falsa', number: '123' };
  const contact = { fullName: 'Juan Pérez', email: 'a@b.com', phone: '+56912345678' };

  // shipping (explicit or default) still requires the full despacho contract.
  assert.throws(() => assertValidCustomer({ ...contact, deliveryMethod: 'shipping', shippingAddress: { ...validAddress, region: '' }, preferredCarrier: 'starken' }), /región/);
  assert.throws(() => assertValidCustomer({ ...contact, deliveryMethod: 'shipping', shippingAddress: { ...validAddress, comuna: '' }, preferredCarrier: 'starken' }), /comuna/);
  assert.throws(() => assertValidCustomer({ ...contact, deliveryMethod: 'shipping', shippingAddress: { ...validAddress, address: '' }, preferredCarrier: 'starken' }), /dirección/);
  assert.throws(() => assertValidCustomer({ ...contact, deliveryMethod: 'shipping', shippingAddress: { ...validAddress, number: '' }, preferredCarrier: 'starken' }), /número/);
  assert.throws(() => assertValidCustomer({ ...contact, deliveryMethod: 'shipping', shippingAddress: validAddress, preferredCarrier: undefined }), /transportista/);

  // store_pickup needs none of that — no address, no carrier.
  const pickup = assertValidCustomer({ ...contact, deliveryMethod: 'store_pickup' });
  assert.equal(pickup.deliveryMethod, 'store_pickup');
  assert.equal(pickup.shippingAddress, null);
  assert.equal(pickup.preferredCarrier, null);

  // Whatever a manipulated client sends for address/carrier under store_pickup is discarded, not validated or trusted.
  const pickupWithJunk = assertValidCustomer({ ...contact, deliveryMethod: 'store_pickup', shippingAddress: { region: 'nonsense', comuna: 'nonsense' }, preferredCarrier: 'not-a-real-carrier' });
  assert.equal(pickupWithJunk.shippingAddress, null);
  assert.equal(pickupWithJunk.preferredCarrier, null);

  // Not sending deliveryMethod at all still defaults to shipping, matching the UI's own default.
  assert.throws(() => assertValidCustomer({ ...contact, shippingAddress: validAddress, preferredCarrier: undefined }), /transportista/);
});

test('villa/población/sector: optional, persisted only for shipping, and never invented for store_pickup', async () => {
  const { assertValidCustomer } = await loadTypeScript('src/features/checkout/validation.ts');
  const validAddress = { region: 'Región Metropolitana de Santiago', comuna: 'Santiago', address: 'Calle Falsa', number: '123', sector: 'Villa Los Aromos' };
  const contact = { fullName: 'Juan Pérez', email: 'a@b.com', phone: '+56912345678', preferredCarrier: 'starken' };

  const withSector = assertValidCustomer({ ...contact, deliveryMethod: 'shipping', shippingAddress: validAddress });
  assert.equal(withSector.shippingAddress.sector, 'Villa Los Aromos');

  const withoutSector = assertValidCustomer({ ...contact, deliveryMethod: 'shipping', shippingAddress: { region: validAddress.region, comuna: validAddress.comuna, address: validAddress.address, number: validAddress.number } });
  assert.equal(withoutSector.shippingAddress.sector, null);
});

test('factura + store_pickup: billing data must be supplied explicitly — there is no despacho address to fall back to, so an incomplete billing address is rejected, not silently contaminated', async () => {
  const { assertValidCustomer } = await loadTypeScript('src/features/checkout/validation.ts');
  const contact = { fullName: 'Juan Pérez', email: 'a@b.com', phone: '+56912345678', deliveryMethod: 'store_pickup', billingDocumentType: 'factura' };
  const validBilling = {
    rut: '76.123.456-0', businessName: 'Mi Empresa SPA', businessActivity: 'Venta de insumos',
    email: 'facturacion@empresa.cl', region: 'Región Metropolitana de Santiago', comuna: 'Providencia', address: 'Av. Siempre Viva', number: '742',
  };

  // Omitting billing region/comuna/address/number has nothing to fall back
  // to under store_pickup (unlike shipping, where it could copy the
  // despacho address) — the resulting empty string must be rejected.
  assert.throws(() => assertValidCustomer({ ...contact, billingData: { ...validBilling, region: '', comuna: '', address: '', number: '' } }), /región de facturación/);

  const ok = assertValidCustomer({ ...contact, billingData: validBilling });
  assert.equal(ok.deliveryMethod, 'store_pickup');
  assert.equal(ok.shippingAddress, null);
  assert.equal(ok.billingData.rut, '761234560');
  assert.equal(ok.billingData.region, 'Región Metropolitana de Santiago');
});

test('V2.1 migration: delivery_method column, shipping_policy CHECK gains \'pickup\', and a coherence constraint ties delivery_method to shipping_policy/preferred_carrier', async () => {
  const sql = await readFile(checkoutV21MigrationPath, 'utf8');
  assert.match(sql, /add column if not exists delivery_method text not null default 'shipping'/);
  assert.match(sql, /check \(delivery_method in \('shipping', 'store_pickup'\)\)/);
  assert.match(sql, /drop constraint if exists orders_shipping_policy_check/);
  assert.match(sql, /check \(shipping_policy in \('free', 'receiver_pays', 'pickup'\)\)/);
  assert.match(sql, /add constraint orders_delivery_shipping_coherence/);
  assert.match(sql, /delivery_method = 'store_pickup' and shipping_policy = 'pickup' and preferred_carrier is null/);
  assert.match(sql, /delivery_method = 'shipping' and shipping_policy in \('free', 'receiver_pays'\) and preferred_carrier is not null/);
});

test('V2.1 migration: is_valid_full_name/is_valid_email/is_valid_cl_mobile mirror the TS validators exactly', async () => {
  const sql = await readFile(checkoutV21MigrationPath, 'utf8');
  const nameFn = sql.match(/create or replace function public\.is_valid_full_name[\s\S]*?\n\$\$;/);
  assert.ok(nameFn, 'is_valid_full_name not found');
  assert.match(nameFn[0], /A-Za-zÀ-ÖØ-öø-ÿ/);
  assert.match(nameFn[0], /length\(p_name\) between 2 and 120/);

  const emailFn = sql.match(/create or replace function public\.is_valid_email[\s\S]*?\n\$\$;/);
  assert.ok(emailFn, 'is_valid_email not found');
  assert.match(emailFn[0], /\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$/);

  const phoneFn = sql.match(/create or replace function public\.is_valid_cl_mobile[\s\S]*?\n\$\$;/);
  assert.ok(phoneFn, 'is_valid_cl_mobile not found');
  assert.match(phoneFn[0], /\^\\\+569\[0-9\]\{8\}\$/);
});

test('V2.1 create_pending_order: adds p_delivery_method, derives shipping_policy from delivery_method + subtotal (never from the client), and forces preferred_carrier/shipping_address to null for store_pickup', async () => {
  const sql = await readFile(checkoutV21MigrationPath, 'utf8');
  assert.match(sql, /drop function if exists public\.create_pending_order\(jsonb, text, text, text, jsonb, text, text, text, jsonb\);/);
  const fnMatch = sql.match(/create or replace function public\.create_pending_order[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'V2.1 create_pending_order not found');
  const fn = fnMatch[0];
  assert.match(fn, /p_delivery_method text default 'shipping'/);
  assert.match(fn, /not public\.is_valid_full_name\(trim\(p_customer_name\)\)/);
  assert.match(fn, /not public\.is_valid_email\(trim\(p_customer_email\)\)/);
  assert.match(fn, /not public\.is_valid_cl_mobile\(trim\(coalesce\(p_customer_phone, ''\)\)\)/);
  assert.match(fn, /v_shipping_policy := case\s*\n\s*when v_delivery_method = 'store_pickup' then 'pickup'\s*\n\s*when v_subtotal >= 50000 then 'free'\s*\n\s*else 'receiver_pays'\s*\n\s*end;/);
  assert.doesNotMatch(fn, /p_shipping_policy/);
  assert.match(fn, /v_shipping_address := null;\s*\n\s*v_preferred_carrier := null;/);
  assert.match(sql, /grant execute on function public\.create_pending_order\(jsonb, text, text, text, jsonb, text, text, text, jsonb, text\) to anon, authenticated;/);
});

test('V2.1 migration stays out of scope: no Mercado Pago, no cron, no emails, no tracking, no transport-carrier APIs, no DTE, no invented pickup-store address', async () => {
  const sql = await readFile(checkoutV21MigrationPath, 'utf8');
  const withoutComments = sql.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(withoutComments, /mercado ?pago|mercadopago/i);
  assert.doesNotMatch(sql, /pg_cron|cron\.schedule/i);
  assert.doesNotMatch(sql, /resend|sendgrid|nodemailer|smtp/i);
  assert.doesNotMatch(sql, /starken\.cl|chilexpress\.cl|blueexpress\.cl|https?:\/\//i);
  assert.doesNotMatch(sql, /documento tributario electrónico|\bdte\b/i);
  assert.doesNotMatch(sql, /tracking_number|tracking_url/i);
});

test('/finalizar-compra: "Forma de entrega" toggle renders before the shipping address section, and store_pickup hides despacho fields entirely', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /2\. Forma de entrega/);
  assert.match(page, /Retiro en tienda — Gratis/);
  assert.match(page, /Te avisaremos cuando tu pedido esté listo para retirar\./);
  const formaEntregaIndex = page.indexOf('2. Forma de entrega');
  const direccionIndex = page.indexOf('Dirección de despacho');
  assert.ok(formaEntregaIndex >= 0 && direccionIndex > formaEntregaIndex, 'Forma de entrega must render before Dirección de despacho');
  assert.match(page, /\{isShipping && \(/);
});

test('/finalizar-compra: villa/población/sector field sits between número and indicaciones de entrega, and is optional', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /htmlFor="sector">Villa \/ población \/ sector \(opcional\)/);
  const numberIndex = page.indexOf('htmlFor="number">Número');
  const sectorIndex = page.indexOf('htmlFor="sector">Villa');
  const notesIndex = page.indexOf('htmlFor="deliveryNotes">Indicaciones de entrega');
  assert.ok(numberIndex >= 0 && sectorIndex > numberIndex && notesIndex > sectorIndex, 'sector must render between número and indicaciones de entrega');
});

test('/finalizar-compra: phone input shows a locked +56 prefix and only accepts sanitized national digits', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /\{CHILE_COUNTRY_CODE\}/);
  assert.match(page, /sanitizeNationalDigits\(event\.target\.value\)/);
  assert.doesNotMatch(page, /<input[^>]*id="phone"[^>]*onChange=\{\(event\) => updateField\('phone'/);
});

test('/finalizar-compra: name/email/phone errors only appear after the field is touched, never before, and use the exact required error copy', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /touched\.fullName && form\.fullName\.trim\(\)\.length > 0 && !isValidFullName\(form\.fullName\)/);
  assert.match(page, /touched\.email && form\.email\.trim\(\)\.length > 0 && !isValidEmail\(form\.email\)/);
  assert.match(page, /touched\.phone && form\.phoneDigits\.length > 0 && !isValidChileanMobile\(normalizedPhone\)/);
  assert.match(page, /'Ingresa un nombre válido\.'/);
  assert.match(page, /'Ingresa un correo electrónico válido\.'/);
  assert.match(page, /'Ingresa un celular chileno válido\.'/);
  assert.match(page, /onBlur=\{\(\) => markTouched\('fullName'\)\}/);
  assert.match(page, /onBlur=\{\(\) => markTouched\('email'\)\}/);
  assert.match(page, /onBlur=\{\(\) => markTouched\('phone'\)\}/);
});

test('/finalizar-compra: "usar misma dirección" checkbox only renders for shipping, never for store_pickup', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /\{isShipping && \(\s*\n\s*<label className="flex items-center gap-2 text-sm font-semibold text-insumos-ink">\s*\n\s*<input\s*\n\s*type="checkbox"\s*\n\s*checked=\{form\.useSameAddressForBilling\}/);
  assert.match(page, /useSameAddressForBilling: false/); // forced off by updateDeliveryMethod on switch to pickup
});

test('/finalizar-compra: summary panel shows "Retiro en tienda" / GRATIS with no free-shipping progress bar when store_pickup is selected', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /<span>Entrega<\/span>/);
  assert.match(page, /<span>Retiro en tienda<\/span>/);
  assert.match(page, /<span>Costo<\/span>/);
  assert.match(page, /Retira tu pedido sin costo en tienda\./);
  // The free-shipping progress bar block is gated behind isShipping.
  const progressBarIndex = page.indexOf('Te faltan {formatPrice(remainderForFreeShipping)}');
  const isShippingGateIndex = page.lastIndexOf('{isShipping && (', progressBarIndex);
  assert.ok(isShippingGateIndex >= 0, 'free-shipping progress bar must be gated behind isShipping');
});

// ==========================================================================
// /finalizar-compra: editable order summary (increment/decrement/remove
// reuse InsumosCartProvider directly — no second cart state), CTA moved
// into the summary card as "Ir a pagar".
// ==========================================================================

test('/finalizar-compra: summary line items expose increase/decrease/remove controls wired directly to useInsumosCart (increment/decrement/removeItem) — no second cart state or duplicated line-item logic', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  // Pulled straight off the same context /carrito already uses — proves
  // this isn't a parallel cart implementation.
  assert.match(page, /const \{ items, subtotal, clearCart, hydrated, increment, decrement, removeItem \} = useInsumosCart\(\);/);
  assert.match(page, /onClick=\{\(\) => increment\(item\.productId, item\.variantId\)\}/);
  assert.match(page, /onClick=\{\(\) => decrement\(item\.productId, item\.variantId\)\}/);
  assert.match(page, /onClick=\{\(\) => removeItem\(item\.productId, item\.variantId\)\}/);
  // Only one place in the whole file renders a cart line list (the other
  // items.map — mapping to {variantId, quantity} for the checkout request
  // body — is a single-expression object-literal map, not a render) — no
  // shadow array, no local quantity state duplicating what the context holds.
  const itemsRenderMapCount = (page.match(/\{items\.map\(\(item\) => \{/g) || []).length;
  assert.strictEqual(itemsRenderMapCount, 1, 'exactly one items.map(...) => { — a second render map would mean a duplicated cart render');
});

test('/finalizar-compra: decrease button floors at 1 (never removes via decrement) and increase button is capped by real stockAvailable, exactly like /carrito', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /disabled=\{item\.quantity <= 1\}/);
  assert.match(page, /const atMaxStock = item\.stockAvailable !== null && item\.quantity >= item\.stockAvailable;/);
  assert.match(page, /disabled=\{atMaxStock\}/);
});

test('/finalizar-compra: each summary line shows image, product name, variant, unit price, quantity and line subtotal', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  const asideIndex = page.indexOf('<aside');
  const summarySection = page.slice(asideIndex);
  assert.match(summarySection, /item\.imageUrl/);
  assert.match(summarySection, /\{item\.productName\}/);
  assert.match(summarySection, /\{item\.variantName\}/);
  assert.match(summarySection, /\{formatPrice\(item\.unitPrice\)\} c\/u/);
  assert.match(summarySection, /\{item\.quantity\}/);
  assert.match(summarySection, /\{formatPrice\(item\.unitPrice \* item\.quantity\)\}/);
});

test('/finalizar-compra: subtotal, total and free-shipping progress all read from the same reactive `subtotal`/`items` the edit controls mutate — nothing is snapshotted separately', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  // subtotal/remainderForFreeShipping/shippingPolicy are derived (useMemo)
  // from the exact same `subtotal` destructured from useInsumosCart() that
  // increment/decrement/removeItem update — editing a line therefore
  // recalculates all of these on the next render with no extra plumbing.
  assert.match(page, /const shippingPolicy = useMemo\(\(\) => computeShippingPolicy\(subtotal\), \[subtotal\]\);/);
  assert.match(page, /const remainderForFreeShipping = useMemo\(\(\) => amountUntilFreeShipping\(subtotal\), \[subtotal\]\);/);
  assert.match(page, /<span>Subtotal productos<\/span>\s*\n\s*<span>\{formatPrice\(subtotal\)\}<\/span>/);
  assert.match(page, /<span>Total<\/span>\s*\n\s*<span>\{formatPrice\(subtotal\)\}<\/span>/);
});

test('/finalizar-compra: emptying the cart from the summary controls cannot reach the submit handler — the existing empty-cart guard redirects to /carrito before any form renders', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /if \(hydrated && items\.length === 0 && !orderPlaced\) router\.replace\('\/carrito'\);/);
  assert.match(page, /if \(!hydrated \|\| \(items\.length === 0 && !orderPlaced\)\) \{\s*\n\s*return <div className="min-h-screen bg-insumos-cream" \/>;/);
  // The guard runs before the <form>/CTA are ever returned, so removing the
  // last line makes handleSubmit unreachable without a bespoke empty-state
  // duplicate — /carrito's own empty state (with "Explorar productos") is
  // what the buyer lands on instead.
  const guardIndex = page.indexOf('if (!hydrated || (items.length === 0 && !orderPlaced))');
  const formIndex = page.indexOf('<form onSubmit={handleSubmit}');
  assert.ok(guardIndex >= 0 && formIndex > guardIndex, 'the empty-cart guard must return before the form is reached');
});

test('/finalizar-compra: primary CTA reads "Ir a pagar", lives inside the "Resumen del pedido" card directly below the Total block, and the legacy "Confirmar pedido" button no longer exists anywhere', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.doesNotMatch(page, /Confirmar pedido/);
  assert.match(page, /\{submitting \? 'Enviando pedido\.\.\.' : 'Ir a pagar'\}/);
  const totalBlockIndex = page.indexOf('<span>Total</span>');
  const ctaIndex = page.indexOf("'Ir a pagar'");
  const asideCloseIndex = page.lastIndexOf('</aside>');
  assert.ok(totalBlockIndex >= 0 && ctaIndex > totalBlockIndex && ctaIndex < asideCloseIndex, 'CTA must sit after Total and still inside <aside> (the Resumen del pedido card)');
});

test('/finalizar-compra: the "Ir a pagar" button is the same submit — one <form>, one handleSubmit, one fetch to /api/insumos/checkout — not a second/duplicated checkout flow', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  const formTagCount = (page.match(/<form /g) || []).length;
  assert.strictEqual(formTagCount, 1, 'exactly one <form> — the CTA must submit the existing form, not open a second one');
  const handleSubmitDeclCount = (page.match(/async function handleSubmit/g) || []).length;
  assert.strictEqual(handleSubmitDeclCount, 1);
  const fetchCheckoutCount = (page.match(/fetch\('\/api\/insumos\/checkout'/g) || []).length;
  assert.strictEqual(fetchCheckoutCount, 1);
  // The CTA button itself carries type="submit" with no onClick of its own —
  // it fires the form's onSubmit natively, exactly like the button it replaced.
  const ctaButtonBlock = page.slice(page.indexOf("<span>Total</span>"), page.indexOf("'Ir a pagar'"));
  assert.match(ctaButtonBlock, /type="submit"/);
  assert.doesNotMatch(ctaButtonBlock, /onClick=/);
});

test('/finalizar-compra: submitting with missing/invalid required fields focuses and scrolls to the first invalid field, in addition to the existing error banner', async () => {
  const page = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(page, /function focusField\(id: string\) \{/);
  assert.match(page, /element\.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\);/);
  assert.match(page, /element\.focus\(\{ preventScroll: true \}\);/);
  // 10 total setErrorMessage(...) calls in the file: the initial reset, 7
  // field-validation branches (each paired with focusField), and 2
  // server/network-error branches (response not-ok, catch) which have no
  // single field to focus and correctly stay unpaired.
  const setErrorMessageCalls = (page.match(/setErrorMessage\(/g) || []).length;
  // focusField( matches both the function declaration and its 7 call sites.
  const focusFieldOccurrences = (page.match(/focusField\(/g) || []).length;
  assert.strictEqual(setErrorMessageCalls, 10);
  assert.strictEqual(focusFieldOccurrences, 8);
});

test('/pedido/[id]/confirmacion: shows "Retiro en tienda" for store_pickup orders, hides the carrier line, and never shows "por pagar" for a pickup order', async () => {
  const page = await readFile(new URL('src/app/pedido/[id]/confirmacion/page.tsx', root), 'utf8');
  assert.match(page, /order\.deliveryMethod === 'store_pickup' \? 'Retiro en tienda' : 'Despacho'/);
  assert.match(page, /\{order\.deliveryMethod === 'shipping' && \(/);
  assert.match(page, /order\.shippingPolicy === 'pickup' \? 'Gratis \(retiro en tienda\)'/);
});

test('checkout V2.1 modules (name, email, phone) stay isolated from legacy Artesellos and never hardcode a payment/transport-carrier API endpoint', async () => {
  const files = await Promise.all([
    'src/features/checkout/name.ts',
    'src/features/checkout/email.ts',
    'src/features/checkout/phone.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const legacyPattern = /@\/lib\/supabase|@\/lib\/woocommerce|@\/lib\/cartContext|@\/app\/checkout|checkout\/mp|NEXT_PUBLIC_SUPABASE|Mercado ?Pago|mercadopago|starken\.cl|chilexpress\.cl|blueexpress|https?:\/\//i;
  for (const source of files) {
    assert.doesNotMatch(source, legacyPattern);
  }
});

// ==========================================================================
// Transactional email foundation: provider-agnostic contract, mock/ZeptoMail
// providers, order snapshot, "Pedido recibido" template, non-blocking
// integration into checkout, idempotent delivery tracking.
// ==========================================================================

test('email types.ts defines a provider-agnostic contract (EmailProvider/EmailMessage/EmailSendResult) with no concrete-provider imports', async () => {
  const source = await readFile(new URL('src/features/email/types.ts', root), 'utf8');
  assert.match(source, /export interface EmailProvider/);
  assert.match(source, /export interface EmailMessage/);
  assert.match(source, /export interface EmailSendResult/);
  assert.match(source, /send\(message: EmailMessage\): Promise<EmailSendResult>/);
  assert.doesNotMatch(source, /from '\.\/providers\/|require\(['"]\.\/providers\//);
});

test('provider.ts is the single place that resolves a concrete provider from INSUMOS_EMAIL_PROVIDER, defaulting to mock, with no hardcoded credentials', async () => {
  const source = await readFile(new URL('src/features/email/provider.ts', root), 'utf8');
  assert.match(source, /process\.env\.INSUMOS_EMAIL_PROVIDER/);
  assert.match(source, /\|\| 'mock'/);
  assert.match(source, /case 'mock':/);
  assert.match(source, /case 'zeptomail':/);
  assert.match(source, /process\.env\.INSUMOS_EMAIL_FROM\b/);
  assert.match(source, /process\.env\.INSUMOS_EMAIL_FROM_NAME/);
  assert.doesNotMatch(source, /sk_live|sk_test|api[_-]?key\s*[:=]\s*['"]/i);

  // provider.ts must be the only file importing the concrete providers —
  // everything else (sendTransactionalEmail, checkout) depends on the
  // EmailProvider interface only.
  const [sendTransactional, route] = await Promise.all([
    readFile(new URL('src/features/email/sendTransactionalEmail.ts', root), 'utf8'),
    readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8'),
  ]);
  assert.doesNotMatch(sendTransactional, /providers\/(mock|zeptoMail)EmailProvider/);
  assert.doesNotMatch(route, /providers\/(mock|zeptoMail)EmailProvider/);
});

test('mockEmailProvider never performs a real network call, logs only recipient/subject/event (never the full HTML body), and returns a synthetic mock_ id', async () => {
  const source = await readFile(new URL('src/features/email/providers/mockEmailProvider.ts', root), 'utf8');
  assert.match(source, /providerMessageId: `mock_\$\{randomUUID\(\)\}`/);
  assert.match(source, /to: message\.to\.email/);
  assert.match(source, /subject: message\.subject/);
  assert.match(source, /eventType: message\.metadata\?\.eventType/);
  assert.match(source, /orderId: message\.metadata\?\.orderId/);
  assert.doesNotMatch(source, /message\.html/);
  assert.doesNotMatch(source, /https?:\/\/|\bfetch\(/);
});

test('zeptoMailProvider is an unconfigured stub: no real HTTP call, no invented endpoint/credentials, throws a clear "not configured" error', async () => {
  const source = await readFile(new URL('src/features/email/providers/zeptoMailProvider.ts', root), 'utf8');
  assert.match(source, /throw new Error\('ZeptoMail provider is not configured'\)/);
  assert.doesNotMatch(source, /https?:\/\/|\bfetch\(|api\.zeptomail|zeptomail\.com/i);
  assert.doesNotMatch(source, /sk_live|sk_test|Authorization:|Bearer /i);
});

test('sendTransactionalEmail checks (order_id, event_type) idempotency before ever attempting a send, and skips — never re-sends — when a row already exists', async () => {
  const source = await readFile(new URL('src/features/email/sendTransactionalEmail.ts', root), 'utf8');
  const sendFnStart = source.indexOf('export async function sendTransactionalEmail');
  const sendFnEnd = source.indexOf('export interface RetryTransactionalEmailInput');
  assert.ok(sendFnStart >= 0 && sendFnEnd > sendFnStart, 'could not isolate sendTransactionalEmail body');
  const sendFnBody = source.slice(sendFnStart, sendFnEnd);

  const idempotencyCheckIndex = sendFnBody.indexOf(".eq('event_type', input.eventType)");
  const attemptSendIndex = sendFnBody.indexOf('attemptProviderSend(');
  assert.ok(idempotencyCheckIndex >= 0, 'idempotency select on (order_id, event_type) not found');
  assert.ok(attemptSendIndex > idempotencyCheckIndex, 'the provider must only be reached after the idempotency check');
  assert.match(sendFnBody, /if \(existing\) \{\s*\n\s*return \{ status: 'skipped' \};/);
});

test('sendTransactionalEmail documents and honors the three idempotency outcomes explicitly: sent => skipped, pending => skipped (avoids a concurrent double-send), failed => skipped (left for an explicit retry, never auto-retried)', async () => {
  const source = await readFile(new URL('src/features/email/sendTransactionalEmail.ts', root), 'utf8');
  const sendFnStart = source.indexOf('export async function sendTransactionalEmail');
  const sendFnEnd = source.indexOf('export interface RetryTransactionalEmailInput');
  const sendFnBody = source.slice(sendFnStart, sendFnEnd);
  assert.match(sendFnBody, /sent\s+—\s+already delivered, never resend automatically\./);
  assert.match(sendFnBody, /pending — a concurrent request already claimed this row/);
  assert.match(sendFnBody, /failed {2}— left exactly as-is for an explicit, separate\s*\n\s*\/\/\s*retryTransactionalEmail\(deliveryId\) call/);
  assert.match(sendFnBody, /never retries automatically/);
});

test('sendTransactionalEmail never throws: every path (idempotent skip, insert failure, provider failure, unexpected error) resolves to a result object', async () => {
  const source = await readFile(new URL('src/features/email/sendTransactionalEmail.ts', root), 'utf8');
  const sendFnStart = source.indexOf('export async function sendTransactionalEmail');
  const sendFnEnd = source.indexOf('export interface RetryTransactionalEmailInput');
  assert.ok(sendFnStart >= 0 && sendFnEnd > sendFnStart, 'could not isolate sendTransactionalEmail body');
  const sendFnBody = source.slice(sendFnStart, sendFnEnd);
  assert.doesNotMatch(sendFnBody, /\n\s*throw /);
  assert.match(sendFnBody, /return await attemptProviderSend\(admin, inserted\.id, input\.message\);/);
  assert.match(sendFnBody, /return \{ status: 'failed', error: 'Error inesperado al enviar el correo\.' \};/);
});

test('attemptProviderSend (shared by send and retry) records status=sent with provider_message_id and a cleared last_error on success, and status=failed with last_error on provider failure — neither outcome is silently dropped', async () => {
  const source = await readFile(new URL('src/features/email/sendTransactionalEmail.ts', root), 'utf8');
  assert.match(source, /status: 'sent',\s*\n\s*provider_message_id: result\.providerMessageId,\s*\n\s*sent_at: new Date\(\)\.toISOString\(\),\s*\n\s*last_error: null,/);
  assert.match(source, /status: 'failed', last_error: message2, updated_at:/);
  assert.match(source, /catch \(sendError\) \{/);
  assert.match(source, /console\.error\('\[email\] provider send failed', sendError\)/);
});

test('retryTransactionalEmail only accepts a status="failed" row — retrying an already-sent or still-pending row is rejected (skipped), never re-sent', async () => {
  const source = await readFile(new URL('src/features/email/sendTransactionalEmail.ts', root), 'utf8');
  assert.match(source, /export async function retryTransactionalEmail/);
  assert.match(source, /if \(existing\.status !== 'failed'\) \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*return \{ status: 'skipped' \};/);
});

test('retryTransactionalEmail moves the same failed row to pending, increments attempts, and clears last_error before attempting the provider again — it never inserts a second row', async () => {
  const source = await readFile(new URL('src/features/email/sendTransactionalEmail.ts', root), 'utf8');
  const retryFnMatch = source.match(/export async function retryTransactionalEmail[\s\S]*$/);
  assert.ok(retryFnMatch, 'retryTransactionalEmail body not found');
  const retryFnBody = retryFnMatch[0];

  assert.match(retryFnBody, /const nextAttempts = \(existing\.attempts \|\| 0\) \+ 1;/);
  assert.match(retryFnBody, /status: 'pending', attempts: nextAttempts, last_error: null,/);
  assert.match(retryFnBody, /\.eq\('id', input\.deliveryId\)/);
  assert.match(retryFnBody, /return await attemptProviderSend\(admin, input\.deliveryId, input\.message\);/);
  // The defining property that keeps unique(order_id, event_type) safe:
  // retry only ever updates by id, it never inserts a new delivery row.
  assert.doesNotMatch(retryFnBody, /\.insert\(/);
});

test('retryTransactionalEmail is not wired into checkout, a cron, or any worker — it is a standalone primitive only', async () => {
  const [route, source] = await Promise.all([
    readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8'),
    readFile(new URL('src/features/email/sendTransactionalEmail.ts', root), 'utf8'),
  ]);
  assert.doesNotMatch(route, /retryTransactionalEmail/);
  assert.doesNotMatch(source, /pg_cron|cron\.schedule|setInterval|setTimeout/i);
});

test('sendTransactionalEmail and getOrderEmailData use only the service-role admin client, never the anon/session client — recipient and error data can never leak to buyers', async () => {
  const [sendTransactional, orderEmailData] = await Promise.all([
    readFile(new URL('src/features/email/sendTransactionalEmail.ts', root), 'utf8'),
    readFile(new URL('src/features/email/orderEmailData.ts', root), 'utf8'),
  ]);
  for (const source of [sendTransactional, orderEmailData]) {
    assert.match(source, /createInsumosSupabaseAdmin/);
    assert.doesNotMatch(source, /createInsumosSupabaseServer/);
  }
});

test('getOrderEmailData builds its snapshot only from orders/order_items (never localStorage or the original checkout payload) and excludes billing_data', async () => {
  const source = await readFile(new URL('src/features/email/orderEmailData.ts', root), 'utf8');
  assert.match(source, /\.from\('orders'\)/);
  assert.match(source, /\.from\('order_items'\)/);
  assert.doesNotMatch(source, /localStorage\.|window\.localStorage/);
  // Strip comments before checking: the module's own doc comment explains
  // *why* billing_data is excluded, which would otherwise trip this check —
  // only a real code reference (a select column, a field read) should fail it.
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(withoutComments, /billing_data|billingData/);
  // Explicitly scoped to a single order by id — never trusts a client-supplied filter.
  assert.match(source, /\.eq\('id', orderId\)/);
  assert.match(source, /\.eq\('order_id', orderId\)/);
});

test('the checkout route fires order_received only after the order is already committed, and a notifyOrderReceived failure can never change the HTTP response', async () => {
  const source = await readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8');
  const createIndex = source.indexOf('const confirmation = await createPendingOrder(payload);');
  const notifyCallIndex = source.indexOf('await notifyOrderReceived(confirmation.orderId);');
  const responseIndex = source.indexOf('return NextResponse.json({\n      orderId: confirmation.orderId,');
  assert.ok(createIndex >= 0 && notifyCallIndex > createIndex, 'notifyOrderReceived must be called after createPendingOrder');
  assert.ok(responseIndex > notifyCallIndex, 'the success response must be built after the email attempt, not before');

  // notifyOrderReceived itself swallows everything — its own try/catch never re-throws.
  const notifyFnMatch = source.match(/async function notifyOrderReceived[\s\S]*?\n\}/);
  assert.ok(notifyFnMatch, 'notifyOrderReceived function not found');
  assert.doesNotMatch(notifyFnMatch[0], /\n\s*throw /);
  assert.match(notifyFnMatch[0], /catch \(error\) \{\s*\n\s*console\.error/);
});

test('OrderReceivedEmail: receiver_pays with a preferred carrier shows "Por pagar", the pay-the-carrier note, the carrier label, subtotal and total', async () => {
  const { renderOrderReceivedEmail } = await loadTypeScript('src/features/email/templates/OrderReceivedEmail.tsx');
  const rendered = renderOrderReceivedEmail({
    orderId: '11111111-2222-3333-4444-555555555555',
    customerName: 'Juan Pérez',
    customerEmail: 'juan@example.com',
    createdAt: '2026-09-01T12:00:00.000Z',
    items: [{ productName: 'Anchoero', variantName: '500', quantity: 2, unitPrice: 1500, lineTotal: 3000 }],
    subtotal: 3000,
    shippingTotal: 0,
    total: 3000,
    deliveryMethod: 'shipping',
    shippingPolicy: 'receiver_pays',
    preferredCarrier: 'starken',
    billingDocumentType: 'boleta',
  });
  assert.match(rendered.subject, /Recibimos tu pedido/);
  assert.match(rendered.html, /Por pagar/);
  assert.match(rendered.html, /El despacho se paga directamente al transportista\./);
  assert.match(rendered.html, /Starken/);
  assert.match(rendered.html, /\$3\.000/);
  assert.match(rendered.text, /Por pagar/);
  assert.match(rendered.text, /Starken/);
});

test('OrderReceivedEmail: store_pickup shows "Retiro en tienda — Gratis", no transportista line, and never invents a pickup address', async () => {
  const { renderOrderReceivedEmail } = await loadTypeScript('src/features/email/templates/OrderReceivedEmail.tsx');
  const rendered = renderOrderReceivedEmail({
    orderId: '11111111-2222-3333-4444-555555555555',
    customerName: 'María Muñoz',
    customerEmail: 'maria@example.com',
    createdAt: '2026-09-01T12:00:00.000Z',
    items: [{ productName: 'OMEGA AMBAR 250 cc', variantName: '250cc', quantity: 1, unitPrice: 1500, lineTotal: 1500 }],
    subtotal: 1500,
    shippingTotal: 0,
    total: 1500,
    deliveryMethod: 'store_pickup',
    shippingPolicy: 'pickup',
    preferredCarrier: null,
    billingDocumentType: 'boleta',
  });
  assert.match(rendered.html, /Retiro en tienda — Gratis/);
  assert.doesNotMatch(rendered.html, /Transportista/);
  assert.doesNotMatch(rendered.html, /[Dd]irección/);
  assert.doesNotMatch(rendered.text, /Transportista/);
});

test('OrderReceivedEmail: factura shows only the document type "Factura" — never a RUT, razón social or giro (the data layer excludes billing_data entirely)', async () => {
  const { renderOrderReceivedEmail } = await loadTypeScript('src/features/email/templates/OrderReceivedEmail.tsx');
  const rendered = renderOrderReceivedEmail({
    orderId: '11111111-2222-3333-4444-555555555555',
    customerName: 'Carlos Reyes',
    customerEmail: 'carlos@example.com',
    createdAt: '2026-09-01T12:00:00.000Z',
    items: [{ productName: 'Cera de Coco', variantName: '1 Kg', quantity: 1, unitPrice: 7000, lineTotal: 7000 }],
    subtotal: 7000,
    shippingTotal: 0,
    total: 7000,
    deliveryMethod: 'store_pickup',
    shippingPolicy: 'pickup',
    preferredCarrier: null,
    billingDocumentType: 'factura',
  });
  assert.match(rendered.html, /Factura/);
  assert.doesNotMatch(rendered.html, /RUT|[Rr]azón social|\bgiro\b/);
});

test('OrderReceivedEmail never includes promotional content: no banners, discounts, related products or social-media links', async () => {
  const { renderOrderReceivedEmail } = await loadTypeScript('src/features/email/templates/OrderReceivedEmail.tsx');
  const rendered = renderOrderReceivedEmail({
    orderId: '11111111-2222-3333-4444-555555555555',
    customerName: 'Ana Torres',
    customerEmail: 'ana@example.com',
    createdAt: '2026-09-01T12:00:00.000Z',
    items: [{ productName: 'Avobenzone 250 gr', variantName: '250 gr', quantity: 1, unitPrice: 5000, lineTotal: 5000 }],
    subtotal: 5000,
    shippingTotal: 0,
    total: 5000,
    deliveryMethod: 'shipping',
    shippingPolicy: 'free',
    preferredCarrier: 'chilexpress',
    billingDocumentType: 'boleta',
  });
  assert.doesNotMatch(rendered.html, /descuento|oferta|síguenos|redes sociales|productos relacionados|instagram|facebook/i);
  assert.match(rendered.html, /Te avisaremos cuando tengamos novedades sobre tu pedido\./);
  assert.match(rendered.html, /Envío gratis/);
});

test('email_deliveries migration: table shape, status/attempts constraints, unique(order_id, event_type) idempotency backstop, and updated_at trigger', async () => {
  const sql = await readFile(emailDeliveriesMigrationPath, 'utf8');
  assert.match(sql, /create table if not exists public\.email_deliveries/);
  assert.match(sql, /order_id uuid references public\.orders\(id\) on delete set null/);
  assert.match(sql, /event_type text not null/);
  assert.match(sql, /recipient text not null/);
  assert.match(sql, /provider text not null/);
  assert.match(sql, /provider_message_id text/);
  assert.match(sql, /status text not null default 'pending' check \(status in \('pending', 'sent', 'failed'\)\)/);
  assert.match(sql, /attempts integer not null default 0 check \(attempts >= 0\)/);
  assert.match(sql, /last_error text/);
  assert.match(sql, /sent_at timestamptz/);
  assert.match(sql, /constraint email_deliveries_order_event_unique unique \(order_id, event_type\)/);
  assert.match(sql, /create trigger email_deliveries_set_updated_at before update on public\.email_deliveries/);
});

test('email_deliveries has RLS enabled with zero policies — not even a service-role-scoped one — matching the inventory_reservations precedent of "only reachable via server code, never the client"', async () => {
  const sql = await readFile(emailDeliveriesMigrationPath, 'utf8');
  assert.match(sql, /alter table public\.email_deliveries enable row level security;/);
  assert.doesNotMatch(sql, /create policy[^;]*email_deliveries/);
  assert.doesNotMatch(sql, /grant[^;]*email_deliveries[^;]*to anon/i);
});

test('email_deliveries migration stays out of scope: no ZeptoMail HTTP endpoints, no Mercado Pago, no cron, no retry workers, no pickup address hardcoded', async () => {
  const sql = await readFile(emailDeliveriesMigrationPath, 'utf8');
  const withoutComments = sql.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(withoutComments, /mercado ?pago|mercadopago/i);
  assert.doesNotMatch(sql, /pg_cron|cron\.schedule/i);
  assert.doesNotMatch(sql, /zeptomail\.com|api\.zeptomail|https?:\/\//i);
  assert.doesNotMatch(sql, /retry_worker|queue/i);
  assert.doesNotMatch(sql, /calle |avenida |dirección de retiro/i);
});

test('email module (types, provider, mock/ZeptoMail providers, sendTransactionalEmail, orderEmailData, template) stays isolated from legacy Artesellos and never hardcodes a payment/transport-carrier/ZeptoMail endpoint', async () => {
  const files = await Promise.all([
    'src/features/email/types.ts',
    'src/features/email/provider.ts',
    'src/features/email/sendTransactionalEmail.ts',
    'src/features/email/orderEmailData.ts',
    'src/features/email/providers/mockEmailProvider.ts',
    'src/features/email/providers/zeptoMailProvider.ts',
    'src/features/email/templates/OrderReceivedEmail.tsx',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const legacyPattern = /@\/lib\/supabase|@\/lib\/woocommerce|@\/lib\/cartContext|@\/app\/checkout|checkout\/mp|NEXT_PUBLIC_SUPABASE|Mercado ?Pago|mercadopago|starken\.cl|chilexpress\.cl|blueexpress|zeptomail\.com|api\.zeptomail|https?:\/\//i;
  for (const source of files) {
    assert.doesNotMatch(source, legacyPattern);
  }
});

// ==========================================================================
// Mercado Pago Etapa 1: reserve inventory, create a payment preference
// server-side, redirect the buyer — no webhook, no confirm_order_paid, no
// stock decrement, no real Mercado Pago connection yet.
// ==========================================================================

test('payments/types.ts defines a provider-agnostic contract (PaymentProvider/PaymentPreferenceRequest/Result) with no concrete-provider imports', async () => {
  const source = await readFile(new URL('src/features/payments/types.ts', root), 'utf8');
  assert.match(source, /export interface PaymentProvider/);
  assert.match(source, /export interface PaymentPreferenceRequest/);
  assert.match(source, /export interface PaymentPreferenceResult/);
  assert.match(source, /createPreference\(request: PaymentPreferenceRequest\): Promise<PaymentPreferenceResult>/);
  assert.doesNotMatch(source, /from '\.\/providers\/|require\(['"]\.\/providers\//);
});

test('payments/provider.ts is the single place that resolves a concrete provider from INSUMOS_PAYMENT_PROVIDER, defaulting to mock, with no hardcoded credentials', async () => {
  const source = await readFile(new URL('src/features/payments/provider.ts', root), 'utf8');
  assert.match(source, /process\.env\.INSUMOS_PAYMENT_PROVIDER/);
  assert.match(source, /\|\| 'mock'/);
  assert.match(source, /case 'mock':/);
  assert.match(source, /case 'mercadopago':/);
  assert.doesNotMatch(source, /sk_live|sk_test|APP_USR-|api[_-]?key\s*[:=]\s*['"]/i);

  const [createPreference, route] = await Promise.all([
    readFile(new URL('src/features/payments/createPaymentPreference.ts', root), 'utf8'),
    readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8'),
  ]);
  assert.doesNotMatch(createPreference, /providers\/(mock|mercadoPago)PaymentProvider/);
  assert.doesNotMatch(route, /providers\/(mock|mercadoPago)PaymentProvider/);
});

test('mockPaymentProvider never performs a real network call and returns a synthetic preference id + a checkoutUrl pointing at our own /pago/retorno', async () => {
  const source = await readFile(new URL('src/features/payments/providers/mockPaymentProvider.ts', root), 'utf8');
  assert.match(source, /`mock_pref_\$\{randomUUID\(\)\}`/);
  assert.match(source, /\/pago\/retorno\?/);
  assert.doesNotMatch(source, /\bfetch\(|axios|XMLHttpRequest/);
});

test('mercadoPagoProvider uses the real mercadopago SDK (MercadoPagoConfig/Preference), fails in a controlled way with no access token, and never invents an HTTP endpoint or logs the token', async () => {
  const source = await readFile(new URL('src/features/payments/providers/mercadoPagoProvider.ts', root), 'utf8');
  assert.match(source, /await import\('mercadopago'\)/);
  assert.match(source, /new MercadoPagoConfig\(\{ accessToken \}\)/);
  assert.match(source, /new Preference\(client\)/);
  assert.match(source, /if \(!accessToken\) \{\s*\n\s*return \{ status: 'failed', error: 'Mercado Pago no está configurado\.' \};/);
  assert.doesNotMatch(source, /https?:\/\/api\.mercadopago/);
  assert.doesNotMatch(source, /console\.log\([^)]*accessToken/);
});

test('createPaymentPreference (amount authority): re-reads order.total from the database and its input carries no client-suppliable amount, item price, or item list', async () => {
  const source = await readFile(new URL('src/features/payments/createPaymentPreference.ts', root), 'utf8');
  assert.match(source, /\.from\('orders'\)/);
  assert.match(source, /\.select\('id, status, total,/);
  assert.match(source, /totalAmount: order\.total/);

  const inputInterfaceMatch = source.match(/export interface CreatePaymentPreferenceInput \{[\s\S]*?\n\}/);
  assert.ok(inputInterfaceMatch, 'CreatePaymentPreferenceInput not found');
  assert.doesNotMatch(inputInterfaceMatch[0], /total|amount|price|items/i);
});

test('createPaymentPreference (receiver_pays / pickup): the amount sent to the provider is exactly the sum of persisted order_items line_total, matched against orders.total — no shipping cost is ever added, and delivery_method/shipping_policy are never referenced', async () => {
  const source = await readFile(new URL('src/features/payments/createPaymentPreference.ts', root), 'utf8');
  assert.match(source, /const itemsSum = rows\.reduce\(\(sum, row\) => sum \+ row\.line_total, 0\);/);
  assert.match(source, /if \(itemsSum !== order\.total\) \{/);
  assert.doesNotMatch(source, /shipping_total|shippingTotal|delivery_method|deliveryMethod|shipping_policy|shippingPolicy/);
});

test('createPaymentPreference (idempotency): reuses an existing preference for the same order+provider without ever calling the provider again, and documents why reservation freshness does not need separate tracking', async () => {
  const source = await readFile(new URL('src/features/payments/createPaymentPreference.ts', root), 'utf8');
  const reuseCheckIndex = source.indexOf("if (order.payment_provider === providerName && order.payment_provider_preference_id && order.payment_checkout_url)");
  const providerCallIndex = source.indexOf('provider.createPreference(request)');
  assert.ok(reuseCheckIndex >= 0, 'idempotency reuse check not found');
  assert.ok(providerCallIndex > reuseCheckIndex, 'provider must only be called after the reuse check');
  assert.match(source, /return \{ status: 'reused', paymentUrl: order\.payment_checkout_url, providerPreferenceId: order\.payment_provider_preference_id \};/);
  assert.match(source, /status === 'awaiting_payment' already IS the up-to-date signal/);
});

test('createPaymentPreference never throws — every failure path (order not found, wrong token, not awaiting_payment, invalid total, no items, total mismatch, provider failure, persist failure) resolves to a result object', async () => {
  const source = await readFile(new URL('src/features/payments/createPaymentPreference.ts', root), 'utf8');
  const fnBody = source.slice(source.indexOf('export async function createPaymentPreference'));
  assert.doesNotMatch(fnBody, /\n\s*throw /);
  assert.match(fnBody, /status: 'failed'/);
});

test('checkout route: reservation happens before the payment preference is ever created — a reservation failure never reaches createPaymentPreference', async () => {
  const source = await readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8');
  const reserveIndex = source.indexOf('await reserveOrderInventory(');
  const preferenceIndex = source.indexOf('await createPaymentPreference(');
  assert.ok(reserveIndex >= 0, 'reserveOrderInventory call not found');
  assert.ok(preferenceIndex > reserveIndex, 'createPaymentPreference must only be called after reserveOrderInventory');
});

test('checkout route: a payment preference failure releases the reservation via release_order_payment_reservation (never a direct UPDATE), responds with a non-2xx status, and never marks the order paid', async () => {
  const source = await readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8');
  const failureBranch = source.slice(source.indexOf("if (preference.status === 'failed')"), source.indexOf("return NextResponse.json({\n      orderId: confirmation.orderId,\n      confirmationToken: confirmation.confirmationToken,\n      subtotal:"));
  assert.match(failureBranch, /await releaseOrderPaymentReservation\(confirmation\.orderId, confirmation\.confirmationToken,/);
  assert.match(failureBranch, /status: 502/);
  assert.doesNotMatch(failureBranch, /status: 'paid'|payment_status.*approved|confirm_order_paid/i);
  assert.doesNotMatch(source, /\.from\('orders'\)\.update/);
});

test('checkout route: on success the response includes paymentUrl from the created/reused preference, and the reservation\'s own expires_at (never recomputed) is passed through to createPaymentPreference', async () => {
  const source = await readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8');
  assert.match(source, /const reservationExpiresAt = reservation\[0\]\?\.expiresAt \?\? null;/);
  assert.match(source, /reservationExpiresAt,/);
  assert.match(source, /paymentUrl: preference\.paymentUrl,/);
});

test('checkout route never calls confirm_order_paid, never sets order status to paid, and never trusts a client-supplied amount for the payment preference', async () => {
  const source = await readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8');
  assert.doesNotMatch(source, /confirm_order_paid/);
  assert.doesNotMatch(source, /'paid'/);
  assert.doesNotMatch(source, /body\.total|body\.amount|body\.subtotal|payload\.total|payload\.amount/);
});

test('mutations.ts: reserveOrderInventory and releaseOrderPaymentReservation are thin RPC wrappers with no duplicated reservation/release business logic', async () => {
  const source = await readFile(new URL('src/features/checkout/server/mutations.ts', root), 'utf8');
  assert.match(source, /supabase\.rpc\('reserve_order_inventory', \{/);
  assert.match(source, /supabase\.rpc\('release_order_payment_reservation', \{/);
  // No manual inventory_reservations/product_variants/orders writes
  // anywhere in this file — every state change goes through the RPCs.
  assert.doesNotMatch(source, /\.from\('inventory_reservations'\)|\.from\('product_variants'\)|\.from\('inventory_movements'\)|\.from\('orders'\)/);
  assert.match(source, /if \(error\) console\.error\('\[checkout\] release_order_payment_reservation failed', error\);/);
});

test('/pago/retorno page: never calls confirm_order_paid, never touches payment_status/order status, and never even imports a Supabase/DB client — a browser return can never become payment authority', async () => {
  const source = await readFile(new URL('src/app/pago/retorno/page.tsx', root), 'utf8');
  const withoutComments = source.replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(withoutComments, /confirm_order_paid|payment_status|createInsumosSupabaseAdmin|createInsumosSupabaseServer|supabase/i);
  assert.match(source, /Estamos verificando tu pago/);
  // The one required phrase must appear unconditionally — not only inside
  // an `if` branch for a particular status — so a status=approved
  // querystring gets exactly the same "still verifying" message as any
  // other status.
  const messageIndex = source.indexOf('Estamos verificando tu pago');
  const precedingIfIndex = source.lastIndexOf('{looksRejected', messageIndex);
  assert.ok(precedingIfIndex === -1 || precedingIfIndex > messageIndex, 'the verifying message must not be gated behind a status-specific branch');
});

test('finalizar-compra page redirects to the server-returned paymentUrl via a full navigation (never router.push, never trusting a client-built URL)', async () => {
  const source = await readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8');
  assert.match(source, /window\.location\.href = data\.paymentUrl;/);
  assert.doesNotMatch(source, /router\.push\(`\/pedido\//);
});

test('secrets: INSUMOS_MP_ACCESS_TOKEN is read only by mercadoPagoProvider.ts, and never appears in any client-facing page/component', async () => {
  const [provider, checkoutPage, retornoPage, cartDrawer, cartProvider] = await Promise.all([
    readFile(new URL('src/features/payments/providers/mercadoPagoProvider.ts', root), 'utf8'),
    readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8'),
    readFile(new URL('src/app/pago/retorno/page.tsx', root), 'utf8'),
    readFile(new URL('src/features/cart/CartDrawer.tsx', root), 'utf8'),
    readFile(new URL('src/features/cart/CartProvider.tsx', root), 'utf8'),
  ]);
  assert.match(provider, /INSUMOS_MP_ACCESS_TOKEN/);
  for (const source of [checkoutPage, retornoPage, cartDrawer, cartProvider]) {
    assert.doesNotMatch(source, /INSUMOS_MP_ACCESS_TOKEN|INSUMOS_MP_PUBLIC_KEY/);
  }
  assert.doesNotMatch(checkoutPage, /'use server'/);
});

test('payment_preference_columns migration: adds only payment_provider_preference_id/payment_checkout_url/payment_created_at to orders, no data migration, no RLS/grant changes', async () => {
  const sql = await readFile(paymentPreferenceMigrationPath, 'utf8');
  assert.match(sql, /alter table public\.orders/);
  assert.match(sql, /add column payment_provider_preference_id text unique/);
  assert.match(sql, /add column payment_checkout_url text/);
  assert.match(sql, /add column payment_created_at timestamptz/);
  assert.doesNotMatch(sql, /create policy|grant |revoke |create table|drop table/i);
});

test('payment_preference_columns migration stays out of scope: no Mercado Pago HTTP endpoints, no webhook, no confirm_order_paid changes, no stock/inventory_movements changes', async () => {
  const sql = await readFile(paymentPreferenceMigrationPath, 'utf8');
  const withoutComments = sql.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(withoutComments, /webhook|confirm_order_paid|inventory_movements|stock_quantity/i);
  assert.doesNotMatch(sql, /https?:\/\//i);
});

test('payments module (types, provider, mock/MercadoPago providers, createPaymentPreference) stays isolated from legacy Artesellos — mercadopago itself is expected here, but not the legacy client/env/routes', async () => {
  const files = await Promise.all([
    'src/features/payments/types.ts',
    'src/features/payments/provider.ts',
    'src/features/payments/createPaymentPreference.ts',
    'src/features/payments/providers/mockPaymentProvider.ts',
    'src/features/payments/providers/mercadoPagoProvider.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const legacyPattern = /@\/lib\/supabase|@\/lib\/woocommerce|@\/lib\/cartContext|@\/app\/checkout|checkout\/mp|create-payment-link|NEXT_PUBLIC_SUPABASE\b|(?<!INSUMOS_)MP_ACCESS_TOKEN\b|starken\.cl|chilexpress\.cl|blueexpress/i;
  for (const source of files) {
    assert.doesNotMatch(source, legacyPattern);
  }
});

// ==========================================================================
// Mercado Pago Etapa 1, corrective fix: release_order_payment_reservation
// closes the "order stuck at awaiting_payment with no active reservation"
// gap left by a payment-preference failure, without touching
// release_order_inventory itself (so any other future caller keeps its own
// outcome — e.g. a future "buyer cancelled" flow must end at status =
// 'cancelled', not 'pending', and must NOT reuse this function).
// ==========================================================================

test('release_order_payment_reservation migration: calls release_order_inventory internally (no duplicated release logic), only reverts awaiting_payment -> pending when payment_status is still pending, never touches payment_status itself, and grants match release_order_inventory\'s own buyer-callable model', async () => {
  const sql = await readFile(releasePaymentReservationMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.release_order_payment_reservation[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'release_order_payment_reservation not found');
  const fn = fnMatch[0];

  assert.match(fn, /v_released_count := public\.release_order_inventory\(p_order_id, p_confirmation_token, p_reason\);/);
  assert.match(fn, /if v_status = 'awaiting_payment' and v_payment_status = 'pending' then/);
  assert.match(fn, /update public\.orders set status = 'pending' where id = p_order_id;/);
  // No duplicated reservation-release logic: the only DML this function
  // performs directly is the status UPDATE — everything about
  // inventory_reservations is delegated to release_order_inventory.
  assert.doesNotMatch(fn, /update public\.inventory_reservations/);
  // payment_status is read but never assigned.
  assert.doesNotMatch(fn, /set payment_status/);
  assert.match(sql, /grant execute on function public\.release_order_payment_reservation\(uuid, text, text\) to anon, authenticated;/);
});

test('release_order_payment_reservation migration does not modify release_order_inventory, its grants, or any historical migration', async () => {
  const sql = await readFile(releasePaymentReservationMigrationPath, 'utf8');
  assert.doesNotMatch(sql, /create or replace function public\.release_order_inventory\(/);
  assert.doesNotMatch(sql, /create or replace function public\.reserve_order_inventory\(/);
  assert.doesNotMatch(sql, /create or replace function public\.expire_inventory_reservations\(/);
  assert.doesNotMatch(sql, /create or replace function public\.confirm_order_paid\(/);
  assert.doesNotMatch(sql, /create or replace function public\.create_pending_order\(/);
  assert.doesNotMatch(sql, /alter table public\.orders\s+add column/);

  const reservationsSql = await readFile(reservationsMigrationPath, 'utf8');
  // release_order_inventory itself must remain untouched: still never sets
  // order.status, matching the existing test for that migration exactly.
  const releaseFnMatch = reservationsSql.match(/create or replace function public\.release_order_inventory[\s\S]*?\n\$\$;/);
  assert.doesNotMatch(releaseFnMatch[0], /update public\.orders set status/);
});

test('release_order_payment_reservation: Case 1 (provider failure) — checkout route calls it only in the preference-failure branch, and mutations.ts documents the pending/awaiting_payment semantics it produces', async () => {
  const [route, mutations] = await Promise.all([
    readFile(new URL('src/app/api/insumos/checkout/route.ts', root), 'utf8'),
    readFile(new URL('src/features/checkout/server/mutations.ts', root), 'utf8'),
  ]);
  const failureBranch = route.slice(route.indexOf("if (preference.status === 'failed')"), route.indexOf("return NextResponse.json({\n      orderId: confirmation.orderId,\n      confirmationToken: confirmation.confirmationToken,\n      subtotal:"));
  assert.match(failureBranch, /await releaseOrderPaymentReservation\(/);
  assert.match(mutations, /reverts\s*\n?\s*\*?\s*status from 'awaiting_payment' back to 'pending'/);
});

test('release_order_payment_reservation: Case 2/3 (guarded scope) — the status revert is conditioned on order.status = awaiting_payment, so a release_order_inventory rejection (order not awaiting/pending, already paid/fulfilled) propagates and aborts before any UPDATE runs — never degrades a paid/fulfilled order', async () => {
  const sql = await readFile(releasePaymentReservationMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.release_order_payment_reservation[\s\S]*?\n\$\$;/);
  const fn = fnMatch[0];
  // release_order_inventory is called BEFORE the status check/update, so its
  // own "no es posible liberar un pedido ya pagado" guard (tested elsewhere
  // against release_order_inventory itself) runs first and, on rejection,
  // aborts this function's entire transaction before the UPDATE is reached.
  const releaseCallIndex = fn.indexOf('public.release_order_inventory(');
  const updateIndex = fn.indexOf("update public.orders set status = 'pending'");
  assert.ok(releaseCallIndex >= 0 && updateIndex > releaseCallIndex, 'release_order_inventory must run, and be able to abort, before the status UPDATE');
});

test('release_order_payment_reservation: Case 5 (successful preference) — createPaymentPreference never calls it, so a created/reused preference leaves the order awaiting_payment with its reservation untouched', async () => {
  const createPreference = await readFile(new URL('src/features/payments/createPaymentPreference.ts', root), 'utf8');
  assert.doesNotMatch(createPreference, /releaseOrderPaymentReservation|release_order_payment_reservation|release_order_inventory/);
});

// ==========================================================================
// Mercado Pago Etapa 2A: authoritative webhook — server-side payment
// verification, atomic confirmation, no browser authority.
// ==========================================================================

test('verifyMercadoPagoWebhook implements the official manifest template exactly (id/request-id/ts, HMAC-SHA256, constant-time compare), and the mock-mode skip is gated by the same provider switch as everything else — never a bare "no secret -> allow"', async () => {
  const source = await readFile(new URL('src/features/payments/verifyMercadoPagoWebhook.ts', root), 'utf8');
  assert.match(source, /manifest \+= `id:\$\{parts\.id\}\;`/);
  assert.match(source, /manifest \+= `request-id:\$\{parts\.requestId\}\;`/);
  assert.match(source, /manifest \+= `ts:\$\{parts\.ts\}\;`/);
  assert.match(source, /createHmac\('sha256', secret\)/);
  assert.match(source, /timingSafeEqual\(expectedBuffer, providedBuffer\)/);
  // Lowercasing is conditioned on the id being fully alphanumeric — matching
  // the docs' literal "lowercased if alphanumeric" wording — not an
  // unconditional .toLowerCase() call.
  assert.match(source, /isAlphanumeric\(input\.dataIdFromQuery\)\s*\?\s*input\.dataIdFromQuery\.toLowerCase\(\)\s*:\s*input\.dataIdFromQuery/);

  const noSecretBranch = source.slice(source.indexOf('if (!secret) {'), source.indexOf('if (!input.xSignature)'));
  assert.match(noSecretBranch, /getConfiguredPaymentProviderName\(\) === 'mock'/);
  assert.match(noSecretBranch, /console\.warn/);
  assert.match(noSecretBranch, /status: 'invalid'/);
});

test('verifyMercadoPagoWebhook does not use the mercadopago SDK\'s webhook validator: mercadopago@2.10.0 does not export WebhookSignatureValidator or InvalidWebhookSignatureError (verified directly against the installed package), so the manual HMAC implementation is documented as the only option this pinned version supports', async () => {
  const source = await readFile(new URL('src/features/payments/verifyMercadoPagoWebhook.ts', root), 'utf8');
  const codeOnly = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(codeOnly, /WebhookSignatureValidator|InvalidWebhookSignatureError/);
  assert.match(source, /does not export any WebhookSignatureValidator/);
});

test('verifyMercadoPagoWebhook rejects a missing/malformed x-signature or missing ts/v1 before ever computing an HMAC', async () => {
  const source = await readFile(new URL('src/features/payments/verifyMercadoPagoWebhook.ts', root), 'utf8');
  const missingSigIndex = source.indexOf("if (!input.xSignature) return { status: 'invalid'");
  const malformedIndex = source.indexOf("if (!ts || !v1) return { status: 'invalid'");
  const hmacIndex = source.indexOf('createHmac(');
  assert.ok(missingSigIndex >= 0 && malformedIndex > missingSigIndex && hmacIndex > malformedIndex, 'signature presence/shape must be validated before HMAC computation');
});

test('getMercadoPagoPayment delegates entirely to the configured provider — no concrete provider import, no business logic of its own', async () => {
  const source = await readFile(new URL('src/features/payments/getMercadoPagoPayment.ts', root), 'utf8');
  assert.match(source, /getPaymentProvider\(\)/);
  assert.match(source, /provider\.getPayment\(paymentId\)/);
  assert.doesNotMatch(source, /providers\/(mock|mercadoPago)PaymentProvider/);
});

test('mercadoPagoProvider.getPayment uses the real mercadopago SDK Payment resource (GET /v1/payments/{id} via payment.get), never logs the access token, and deliberately does not invent a preference_id field', async () => {
  const source = await readFile(new URL('src/features/payments/providers/mercadoPagoProvider.ts', root), 'utf8');
  assert.match(source, /const \{ MercadoPagoConfig, Payment \} = await import\('mercadopago'\);/);
  assert.match(source, /new Payment\(client\)/);
  assert.match(source, /payment\.get\(\{ id: paymentId \}\)/);
  assert.doesNotMatch(source, /console\.(log|error)\([^)]*accessToken/);
  const getPaymentFn = source.slice(source.indexOf('async getPayment('));
  assert.doesNotMatch(getPaymentFn, /preferenceId|preference_id/);
});

test('mockPaymentFixtures: mock payment ids are fully self-describing (no shared mutable state, no database), round-trip encode/decode, and reject non-mock ids', async () => {
  const { encodeMockPaymentId, decodeMockPaymentId } = await loadTypeScript('src/features/payments/providers/mockPaymentFixtures.ts');
  const id = encodeMockPaymentId({ status: 'approved', externalReference: 'order-123', amount: 1500, currency: 'CLP' });
  assert.match(id, /^mock_payment_/);
  const decoded = decodeMockPaymentId(id);
  // Compared via JSON rather than assert.deepEqual: `decoded` was created
  // inside the test harness's vm sandbox, which has its own Object/JSON
  // intrinsics — a distinct realm from this file's — so a structurally
  // identical object still fails Node's strict, realm-aware deepEqual.
  assert.equal(JSON.stringify(decoded), JSON.stringify({ status: 'approved', externalReference: 'order-123', amount: 1500, currency: 'CLP' }));
  assert.equal(decodeMockPaymentId('real_1234567890'), null);
  assert.equal(decodeMockPaymentId('mock_payment_not-valid-base64!!!'), null);
});

test('mockPaymentProvider.getPayment never performs network I/O and decodes every field from the fixture-encoded id', async () => {
  const source = await readFile(new URL('src/features/payments/providers/mockPaymentProvider.ts', root), 'utf8');
  const getPaymentFn = source.slice(source.indexOf('async getPayment('));
  assert.doesNotMatch(getPaymentFn, /\bfetch\(|axios|XMLHttpRequest/);
  assert.match(getPaymentFn, /decodeMockPaymentId\(paymentId\)/);
  assert.match(getPaymentFn, /if \(!fixture\) return null;/);
});

test('processMercadoPagoPayment: only status="approved" proceeds past the status check — pending/in_process/rejected/cancelled/refunded/any other status is "ignored" before any database lookup', async () => {
  const source = await readFile(new URL('src/features/payments/processMercadoPagoPayment.ts', root), 'utf8');
  const statusCheckIndex = source.indexOf("if (payment.status !== 'approved')");
  const dbLookupIndex = source.indexOf(".from('orders')");
  assert.ok(statusCheckIndex >= 0 && dbLookupIndex > statusCheckIndex, 'the approved-status gate must run before any order lookup');
  assert.match(source, /return \{ status: 'ignored', reason: `status "\$\{payment\.status\}" no requiere confirmación\.` \};/);
});

test('processMercadoPagoPayment: validates external_reference, provider match, currency, and amount — in that order — strictly before ever calling confirm_order_payment_reference, and never trusts the webhook body for any of these', async () => {
  const source = await readFile(new URL('src/features/payments/processMercadoPagoPayment.ts', root), 'utf8');
  const externalRefIndex = source.indexOf('if (!payment.externalReference)');
  const orderLookupIndex = source.indexOf(".from('orders')");
  const providerCheckIndex = source.indexOf('order.payment_provider !== configuredProvider');
  const currencyIndex = source.indexOf("payment.currencyId !== 'CLP'");
  const amountIndex = source.indexOf('payment.transactionAmount !== order.total');
  const rpcIndex = source.indexOf("admin.rpc('confirm_order_payment_reference'");
  assert.ok(
    externalRefIndex >= 0 && orderLookupIndex > externalRefIndex && providerCheckIndex > orderLookupIndex
      && currencyIndex > providerCheckIndex && amountIndex > currencyIndex && rpcIndex > amountIndex,
    'validation must run in order: external_reference -> order lookup -> provider match -> currency -> amount -> confirm RPC'
  );
  assert.doesNotMatch(source, /request\.(body|json)|webhookBody|req\.body/);
});

test('processMercadoPagoPayment never checks preference_id correlation (documented as unreliable/undocumented on the real Payment API) and never throws — every path resolves to a result object', async () => {
  const source = await readFile(new URL('src/features/payments/processMercadoPagoPayment.ts', root), 'utf8');
  const withoutComments = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(withoutComments, /orders\.payment_provider_preference_id|payment\.preferenceId/);
  assert.match(source, /preference_id correlation[\s\S]*deliberately NOT checked/);
  const fnBody = source.slice(source.indexOf('export async function processMercadoPagoPayment'));
  assert.doesNotMatch(fnBody, /\n {2}throw /);
});

test('processMercadoPagoPayment calls confirm_order_payment_reference (never confirm_order_paid directly), passing String(payment.id) as payment_reference', async () => {
  const source = await readFile(new URL('src/features/payments/processMercadoPagoPayment.ts', root), 'utf8');
  assert.match(source, /admin\.rpc\('confirm_order_payment_reference', \{/);
  assert.match(source, /p_payment_reference: String\(payment\.id\)/);
  assert.doesNotMatch(source, /\.rpc\('confirm_order_paid'/);
});

test('webhook route is thin: parse -> verifyMercadoPagoWebhook -> extract payment id -> processMercadoPagoPayment -> map to HTTP, with no business logic (amount/currency/status checks) inlined', async () => {
  const source = await readFile(new URL('src/app/api/insumos/payments/mercadopago/webhook/route.ts', root), 'utf8');
  assert.match(source, /verifyMercadoPagoWebhook\(\{ xSignature, xRequestId, dataIdFromQuery \}\)/);
  assert.match(source, /processMercadoPagoPayment\(paymentId\)/);
  const withoutComments = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(withoutComments, /transaction_amount|currency_id|external_reference|createHmac/);
});

test('webhook route: invalid signature is rejected with 401 before the request body is ever parsed', async () => {
  const source = await readFile(new URL('src/app/api/insumos/payments/mercadopago/webhook/route.ts', root), 'utf8');
  const verifyIndex = source.indexOf("if (verification.status === 'invalid')");
  const status401Index = source.indexOf('status: 401 }');
  const bodyParseIndex = source.indexOf('await request.json()');
  assert.ok(verifyIndex >= 0 && status401Index > verifyIndex && bodyParseIndex > status401Index, 'signature must be verified, and 401 returned, before request.json() is ever called');
});

test('webhook route: confirmed/ignored/rejected all map to HTTP 200 (per Mercado Pago guidance, to avoid unnecessary retries), only a genuine internal error maps to 500', async () => {
  const source = await readFile(new URL('src/app/api/insumos/payments/mercadopago/webhook/route.ts', root), 'utf8');
  assert.match(source, /if \(outcome\.status === 'error'\) \{\s*\n\s*return NextResponse\.json\(\{ status: outcome\.status, reason: outcome\.reason \}, \{ status: 500 \}\);/);
  assert.match(source, /return NextResponse\.json\(\{ status: outcome\.status, reason: outcome\.reason \}, \{ status: 200 \}\);/);
});

test('webhook route stays isolated from legacy Artesellos: no import from src/app/api/checkout/mp, no legacy Supabase client, no hardcoded transport/payment endpoints', async () => {
  const source = await readFile(new URL('src/app/api/insumos/payments/mercadopago/webhook/route.ts', root), 'utf8');
  // "checkout/mp" legitimately appears in this file's own doc comment
  // explaining that it does NOT touch that legacy path — only real imports
  // matter here.
  assert.doesNotMatch(source, /from ['"].*checkout\/mp/);
  assert.doesNotMatch(source, /@\/lib\/supabase|NEXT_PUBLIC_SUPABASE\b|createSupabaseServer|createSupabaseAdmin/);
});

test('confirm_order_payment_reference migration: reuses confirm_order_paid entirely (no duplicated reservation/stock/movement logic), locks the order row first, sets payment_reference before confirming so the UNIQUE constraint is the cross-order backstop, and is service_role-only', async () => {
  const sql = await readFile(confirmOrderPaymentReferenceMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.confirm_order_payment_reference[\s\S]*?\n\$\$;/);
  assert.ok(fnMatch, 'confirm_order_payment_reference not found');
  const fn = fnMatch[0];

  assert.match(fn, /select \* into v_order from public\.orders where id = p_order_id for update;/);
  assert.match(fn, /update public\.orders set payment_reference = p_payment_reference where id = p_order_id;/);
  assert.match(fn, /select \* into v_confirm from public\.confirm_order_paid\(p_order_id\);/);
  assert.doesNotMatch(fn, /update public\.inventory_reservations|update public\.product_variants|insert into public\.inventory_movements/);

  const updateIndex = fn.indexOf('update public.orders set payment_reference');
  const confirmCallIndex = fn.indexOf('public.confirm_order_paid(p_order_id)');
  assert.ok(updateIndex >= 0 && confirmCallIndex > updateIndex, 'payment_reference must be set before confirm_order_paid runs, in the same transaction');

  assert.match(sql, /revoke all on function public\.confirm_order_payment_reference\(uuid, text\) from public;/);
  assert.match(sql, /revoke all on function public\.confirm_order_payment_reference\(uuid, text\) from anon;/);
  assert.match(sql, /revoke all on function public\.confirm_order_payment_reference\(uuid, text\) from authenticated;/);
  assert.match(sql, /grant execute on function public\.confirm_order_payment_reference\(uuid, text\) to service_role;/);
});

test('confirm_order_payment_reference migration: idempotent re-call with the SAME payment_reference on an already-paid order returns already_confirmed without writing anything; a DIFFERENT payment_reference on an already-paid order is rejected explicitly, not silently overwritten', async () => {
  const sql = await readFile(confirmOrderPaymentReferenceMigrationPath, 'utf8');
  const fnMatch = sql.match(/create or replace function public\.confirm_order_payment_reference[\s\S]*?\n\$\$;/);
  const fn = fnMatch[0];
  assert.match(fn, /if v_order\.status = 'paid' then/);
  assert.match(fn, /if v_order\.payment_reference = p_payment_reference then/);
  assert.match(fn, /return query select v_order\.id, v_order\.status, v_order\.payment_status, v_order\.payment_reference, true;/);
  assert.match(fn, /raise exception 'Este pedido ya fue confirmado con un payment_reference distinto\.';/);
});

test('confirm_order_payment_reference migration does not modify confirm_order_paid, release_order_payment_reservation, or any historical migration', async () => {
  const sql = await readFile(confirmOrderPaymentReferenceMigrationPath, 'utf8');
  assert.doesNotMatch(sql, /create or replace function public\.confirm_order_paid\(/);
  assert.doesNotMatch(sql, /create or replace function public\.release_order_inventory\(/);
  assert.doesNotMatch(sql, /create or replace function public\.release_order_payment_reservation\(/);
  assert.doesNotMatch(sql, /create or replace function public\.reserve_order_inventory\(/);
  assert.doesNotMatch(sql, /alter table public\.orders\s+add column/);
});

test('/pago/retorno page and finalizar-compra page never reference the webhook route, confirm_order_payment_reference, or INSUMOS_MP_WEBHOOK_SECRET — payment confirmation stays entirely server-to-server', async () => {
  const [retorno, checkoutPage] = await Promise.all([
    readFile(new URL('src/app/pago/retorno/page.tsx', root), 'utf8'),
    readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8'),
  ]);
  const stripComments = (source) => source.replace(/\/\/[^\n]*/g, '');
  const forbidden = /confirm_order_payment_reference|confirm_order_paid|payments\/mercadopago\/webhook|INSUMOS_MP_WEBHOOK_SECRET/;
  assert.doesNotMatch(stripComments(retorno), forbidden);
  assert.doesNotMatch(stripComments(checkoutPage), forbidden);
});

test('secrets: INSUMOS_MP_WEBHOOK_SECRET is read only by verifyMercadoPagoWebhook.ts, and never appears in any client-facing page/component; INSUMOS_MP_ACCESS_TOKEN stays confined to mercadoPagoProvider.ts even with the new getPayment method', async () => {
  const [verify, accessTokenFile, retorno, checkoutPage, cartDrawer, cartProvider] = await Promise.all([
    readFile(new URL('src/features/payments/verifyMercadoPagoWebhook.ts', root), 'utf8'),
    readFile(new URL('src/features/payments/providers/mercadoPagoProvider.ts', root), 'utf8'),
    readFile(new URL('src/app/pago/retorno/page.tsx', root), 'utf8'),
    readFile(new URL('src/app/finalizar-compra/page.tsx', root), 'utf8'),
    readFile(new URL('src/features/cart/CartDrawer.tsx', root), 'utf8'),
    readFile(new URL('src/features/cart/CartProvider.tsx', root), 'utf8'),
  ]);
  assert.match(verify, /INSUMOS_MP_WEBHOOK_SECRET/);
  assert.match(accessTokenFile, /INSUMOS_MP_ACCESS_TOKEN/);
  for (const source of [retorno, checkoutPage, cartDrawer, cartProvider]) {
    assert.doesNotMatch(source, /INSUMOS_MP_WEBHOOK_SECRET|INSUMOS_MP_ACCESS_TOKEN|INSUMOS_MP_PUBLIC_KEY/);
  }
});

test('no code path lets the browser reach confirm_order_paid or confirm_order_payment_reference: neither RPC name appears in any src/app page component (outside of doc comments explaining that guarantee), only in server-only payment/checkout modules', async () => {
  const pageFiles = await Promise.all([
    'src/app/pago/retorno/page.tsx',
    'src/app/finalizar-compra/page.tsx',
    'src/app/pedido/[id]/confirmacion/page.tsx',
  ].map((p) => readFile(new URL(p, root), 'utf8')));
  for (const source of pageFiles) {
    assert.doesNotMatch(source.replace(/\/\/[^\n]*/g, ''), /confirm_order_paid|confirm_order_payment_reference/);
  }
});

test('payments Etapa 2A module (webhook verification, payment lookup, processing) stays isolated from legacy Artesellos', async () => {
  const files = await Promise.all([
    'src/features/payments/verifyMercadoPagoWebhook.ts',
    'src/features/payments/getMercadoPagoPayment.ts',
    'src/features/payments/processMercadoPagoPayment.ts',
    'src/features/payments/providers/mockPaymentFixtures.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')));
  const legacyPattern = /@\/lib\/supabase|@\/lib\/woocommerce|@\/lib\/cartContext|@\/app\/checkout|checkout\/mp|create-payment-link|NEXT_PUBLIC_SUPABASE\b|(?<!INSUMOS_)MP_ACCESS_TOKEN\b|starken\.cl|chilexpress\.cl|blueexpress/i;
  for (const source of files) {
    assert.doesNotMatch(source, legacyPattern);
  }
});

// ==========================================================================
// Customer profile Etapa 2: customers master table + orders.buyer_id +
// historical backfill + RLS. Structure only — no checkout integration, no
// admin UI, no queries module yet.
// ==========================================================================

test('customers migration: table shape matches the approved design exactly (id, user_id, email_normalized, phone_normalized, rut_normalized, full_name, created_at, updated_at)', async () => {
  const sql = await readFile(customersMigrationPath, 'utf8');
  const createIndex = sql.indexOf('create unique index');
  const createTableBlock = sql.slice(sql.indexOf('create table public.customers'), createIndex);
  assert.match(createTableBlock, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(createTableBlock, /user_id uuid references auth\.users\(id\) on delete set null/);
  assert.match(createTableBlock, /email_normalized text not null/);
  assert.match(createTableBlock, /phone_normalized text,/);
  assert.match(createTableBlock, /rut_normalized text,/);
  assert.match(createTableBlock, /full_name text,/);
  assert.match(createTableBlock, /created_at timestamptz not null default now\(\)/);
  assert.match(createTableBlock, /updated_at timestamptz not null default now\(\)/);
});

test('customers migration: UNIQUE index exists only on email_normalized — phone_normalized, rut_normalized and full_name are deliberately not unique', async () => {
  const sql = await readFile(customersMigrationPath, 'utf8');
  assert.match(sql, /create unique index customers_email_normalized_key on public\.customers\(email_normalized\);/);
  const uniqueIndexCount = (sql.match(/create unique index/g) || []).length;
  assert.strictEqual(uniqueIndexCount, 1, 'exactly one unique index — no accidental uniqueness on phone/rut/name');
  assert.doesNotMatch(sql, /create unique index[^;]*phone_normalized/);
  assert.doesNotMatch(sql, /create unique index[^;]*rut_normalized/);
  assert.doesNotMatch(sql, /create unique index[^;]*full_name/);
});

test('customers migration: orders.buyer_id is a new nullable FK to customers(id) on delete set null — orders.customer_id (the legacy profiles FK) is never referenced, altered or dropped anywhere in this file', async () => {
  const sql = await readFile(customersMigrationPath, 'utf8');
  assert.match(sql, /alter table public\.orders add column buyer_id uuid references public\.customers\(id\) on delete set null;/);
  // buyer_id must not be declared "not null" — nullable is required so
  // existing/guest orders keep working with zero backfill dependency.
  assert.doesNotMatch(sql, /buyer_id uuid[^,\n]*not null/);
  // Strip SQL comments first — the migration's own doc comments legitimately
  // mention "orders.customer_id" to explain why it's untouched, which would
  // otherwise trip a naive substring check.
  const codeOnly = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(codeOnly, /orders\.customer_id|customer_id uuid|drop column customer_id|alter column customer_id/);
});

test('customers migration: RLS enabled with the same admin/staff-only has_role() policy pattern orders already uses — no anon policy, no buyer-facing read policy', async () => {
  const sql = await readFile(customersMigrationPath, 'utf8');
  assert.match(sql, /alter table public\.customers enable row level security;/);
  assert.match(sql, /create policy "catalog managers manage customers" on public\.customers for all\s*\n\s*using \(public\.has_role\('admin'\) or public\.has_role\('staff'\)\)\s*\n\s*with check \(public\.has_role\('admin'\) or public\.has_role\('staff'\)\);/);
  // Exactly one policy — no separate "customers read own record" or
  // anon/authenticated-facing policy has been added yet, matching the
  // explicit "no buyer read policy yet" scope for this stage.
  const policyCount = (sql.match(/create policy/g) || []).length;
  assert.strictEqual(policyCount, 1);
  assert.doesNotMatch(sql, /to anon|to authenticated|auth\.uid\(\) = /);
});

test('customers migration: updated_at reuses the existing public.set_updated_at() trigger function — no new/duplicated trigger mechanism defined', async () => {
  const sql = await readFile(customersMigrationPath, 'utf8');
  assert.match(sql, /create trigger customers_set_updated_at before update on public\.customers for each row execute function public\.set_updated_at\(\);/);
  assert.doesNotMatch(sql, /create (or replace )?function public\.set_updated_at/);
  assert.doesNotMatch(sql, /create function/i);
});

test('customers migration backfill: groups orders by lower(trim(customer_email)) — the same trim+lowercase normalizeEmail() already applies — so two orders sharing an email collapse into exactly one customers row', async () => {
  const sql = await readFile(customersMigrationPath, 'utf8');
  const insertBlock = sql.slice(sql.indexOf('insert into public.customers'), sql.indexOf('update public.orders'));
  assert.match(insertBlock, /lower\(trim\(o\.customer_email\)\)/);
  assert.match(insertBlock, /group by lower\(trim\(o\.customer_email\)\)/);
  // created_at must be the first known purchase, never migration time.
  assert.match(insertBlock, /min\(o\.created_at\) as created_at/);
  assert.doesNotMatch(insertBlock, /created_at\) values\s*\([^)]*now\(\)/);
});

test('customers migration backfill: full_name/phone_normalized are each taken independently from the most recent order with a non-empty value for that specific field', async () => {
  const sql = await readFile(customersMigrationPath, 'utf8');
  const insertBlock = sql.slice(sql.indexOf('insert into public.customers'), sql.indexOf('update public.orders'));
  assert.match(insertBlock, /array_agg\(o\.customer_name order by o\.created_at desc\) filter \(where coalesce\(trim\(o\.customer_name\), ''\) <> ''\)/);
  assert.match(insertBlock, /array_agg\(o\.customer_phone order by o\.created_at desc\) filter \(where coalesce\(trim\(o\.customer_phone\), ''\) <> ''\)/);
});

test('customers migration backfill: is idempotent (ON CONFLICT on the unique email index, buyer_id UPDATE guarded by IS DISTINCT FROM) and never writes back to any orders snapshot column', async () => {
  const sql = await readFile(customersMigrationPath, 'utf8');
  assert.match(sql, /on conflict \(email_normalized\) do update set/);
  assert.match(sql, /update public\.orders o\s*\nset buyer_id = c\.id/);
  assert.match(sql, /and o\.buyer_id is distinct from c\.id/);
  // The only "update public.orders" statement in the file must touch
  // buyer_id alone — never customer_email/name/phone/shipping_address/billing_data.
  // customer_email legitimately appears later in this same statement's WHERE
  // clause (read-only, for the join condition) — so isolate just the SET
  // clause itself (between "set" and "from") rather than the whole statement.
  const ordersUpdateCount = (sql.match(/update public\.orders/g) || []).length;
  assert.strictEqual(ordersUpdateCount, 1);
  const setClauseStart = sql.indexOf('set buyer_id', sql.indexOf('update public.orders'));
  const setClauseEnd = sql.indexOf('from public.customers', setClauseStart);
  const setClause = sql.slice(setClauseStart, setClauseEnd);
  assert.doesNotMatch(setClause, /customer_email|customer_name|customer_phone|shipping_address|billing_data/);
});

test('customers migration stays out of scope: no checkout RPCs, no Mercado Pago, no webhook, no reservations, no inventory/stock touched', async () => {
  const sql = await readFile(customersMigrationPath, 'utf8');
  assert.doesNotMatch(sql, /create_pending_order|confirm_order_paid|confirm_order_payment_reference|reserve_order_inventory|release_order_inventory|release_order_payment_reservation|inventory_movements|inventory_reservations|stock_quantity|mercadopago|payment_reference/i);
});

// ==========================================================================
// Customer profile Etapa 3: backend/queries only — listCustomers,
// getCustomerById, listCustomerOrders. No admin UI, no mutations, no
// checkout integration yet.
// ==========================================================================

test('customers/server/queries.ts: listCustomers supports pagination (page/pageSize in, {customers,total,page,pageSize} out)', async () => {
  const source = await readFile(new URL('src/features/customers/server/queries.ts', root), 'utf8');
  assert.match(source, /export async function listCustomers\(params: ListCustomersParams = \{\}\): Promise<ListCustomersResult>/);
  assert.match(source, /const page = Math\.max\(1, params\.page \?\? 1\);/);
  assert.match(source, /const pageSize = Math\.min\(MAX_PAGE_SIZE, Math\.max\(1, params\.pageSize \?\? DEFAULT_PAGE_SIZE\)\);/);
  assert.match(source, /return \{ customers: withSummaries\.slice\(start, start \+ pageSize\), total, page, pageSize \};/);
});

test('customers/server/queries.ts: listCustomers searches email_normalized, full_name and phone_normalized together (case-insensitive), sanitizing the term against PostgREST filter-string syntax first', async () => {
  const source = await readFile(new URL('src/features/customers/server/queries.ts', root), 'utf8');
  assert.match(source, /function sanitizeSearchTerm\(raw: string\): string \{\s*\n\s*return raw\.trim\(\)\.replace\(\/\[,\(\)\]\/g, ''\);/);
  assert.match(source, /query\.or\(`email_normalized\.ilike\.\$\{pattern\},full_name\.ilike\.\$\{pattern\},phone_normalized\.ilike\.\$\{pattern\}`\)/);
  assert.match(source, /const pattern = `%\$\{term\.toLowerCase\(\)\}%`;/);
});

test('customers/server/queries.ts: commercial metrics (totalOrders/totalSpent/averageOrderValue/firstOrderAt/lastOrderAt) only ever count status IN (paid, fulfilled) — cancelled, pending and awaiting_payment orders are all excluded, and the same filter is used for both listCustomers and getCustomerById so the average is never computed over a mismatched numerator/denominator', async () => {
  const source = await readFile(new URL('src/features/customers/server/queries.ts', root), 'utf8');
  assert.match(source, /const COMMERCIAL_ORDER_STATUSES = \['paid', 'fulfilled'\] as const;/);
  // Strip both comment styles — doc comments legitimately discuss why
  // cancelled/pending/awaiting_payment are excluded, which would otherwise
  // trip a naive substring check against the actual code.
  const codeOnly = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(codeOnly, /'cancelled'|'pending'|'awaiting_payment'/);
  // Both call sites reuse the same constant — no second, possibly-drifted status list.
  const commercialStatusUsages = (source.match(/COMMERCIAL_ORDER_STATUSES/g) || []).length;
  assert.ok(commercialStatusUsages >= 4, 'the single COMMERCIAL_ORDER_STATUSES constant must be reused by the .in() filter, isCommercialStatus(), and both its doc-comment references');
  assert.match(source, /averageOrderValue: Math\.round\(totalSpent \/ rows\.length\)/);
});

test('customers/server/queries.ts: getCustomerById returns master data + the same commercial summary + preferences (delivery method/carrier/billing doc type) derived from the single most recent order regardless of its status, defaulting to null rather than guessing when the customer has no orders', async () => {
  const source = await readFile(new URL('src/features/customers/server/queries.ts', root), 'utf8');
  assert.match(source, /export async function getCustomerById\(customerId: string\): Promise<CustomerProfile \| null>/);
  assert.match(source, /const mostRecent = orders\[0\] \?\? null;/);
  assert.match(source, /lastDeliveryMethod: mostRecent\?\.delivery_method \?\? null,/);
  assert.match(source, /lastPreferredCarrier: mostRecent\?\.preferred_carrier \?\? null,/);
  assert.match(source, /lastBillingDocumentType: mostRecent\?\.billing_document_type \?\? null,/);
  // mostRecent is index 0 of the orders query — which must itself already be
  // sorted created_at desc for "most recent" to be correct.
  const ordersQueryIndex = source.indexOf(".from('orders')", source.indexOf('getCustomerById'));
  const ordersQueryBlock = source.slice(ordersQueryIndex, source.indexOf(';', ordersQueryIndex));
  assert.match(ordersQueryBlock, /\.order\('created_at', \{ ascending: false \}\)/);
});

test('customers/server/queries.ts: listCustomerOrders returns full history newest-first, unfiltered by status (unlike the commercial summary, cancelled/pending orders stay visible for admin context)', async () => {
  const source = await readFile(new URL('src/features/customers/server/queries.ts', root), 'utf8');
  assert.match(source, /export async function listCustomerOrders\(customerId: string\): Promise<CustomerOrderSummary\[\]>/);
  const fnStart = source.indexOf('export async function listCustomerOrders');
  const fnBody = source.slice(fnStart, source.indexOf('\n}\n', fnStart));
  assert.match(fnBody, /\.eq\('buyer_id', customerId\)/);
  assert.match(fnBody, /\.order\('created_at', \{ ascending: false \}\)/);
  assert.doesNotMatch(fnBody, /\.in\('status'|COMMERCIAL_ORDER_STATUSES/);
});

test('customers/server/queries.ts: order snapshot fields (customer_name/customer_email/customer_phone/shipping_address) are read and returned as-is — the module never calls .update()/.insert()/.delete() on orders or customers, so no snapshot or backfilled row can be altered by a read', async () => {
  const source = await readFile(new URL('src/features/customers/server/queries.ts', root), 'utf8');
  assert.match(source, /customer_name, customer_email, customer_phone, shipping_address/);
  assert.match(source, /customerName: row\.customer_name,\s*\n\s*customerEmail: row\.customer_email,\s*\n\s*customerPhone: row\.customer_phone,\s*\n\s*shippingAddress: row\.shipping_address,/);
  assert.doesNotMatch(source, /\.update\(|\.insert\(|\.delete\(|\.upsert\(/);
});

test('customers/server/queries.ts: every exported query requires admin/staff via requireCustomerManager() before touching Supabase, and requireCustomerManager reuses requireInsumosRole (no copied/duplicated auth logic)', async () => {
  const source = await readFile(new URL('src/features/customers/server/queries.ts', root), 'utf8');
  const authSource = await readFile(new URL('src/features/auth/server/authorization.ts', root), 'utf8');
  assert.match(authSource, /export const requireCustomerManager = \(\) => requireInsumosRole\(\['admin', 'staff'\]\);/);
  const exportedFns = ['listCustomers', 'getCustomerById', 'listCustomerOrders'];
  for (const fnName of exportedFns) {
    const fnStart = source.indexOf(`export async function ${fnName}`);
    assert.ok(fnStart >= 0, `${fnName} must be exported`);
    const nextLines = source.slice(fnStart, fnStart + 200);
    assert.match(nextLines, /await requireCustomerManager\(\);/);
  }
  assert.match(source, /import \{ requireCustomerManager \} from '@\/features\/auth\/server\/authorization';/);
});

test('customers/server/queries.ts and types.ts stay isolated from legacy Artesellos: no @/lib/supabase, no NEXT_PUBLIC_SUPABASE, no woocommerce/cartContext, server-only', async () => {
  const [queriesSource, typesSource] = await Promise.all([
    readFile(new URL('src/features/customers/server/queries.ts', root), 'utf8'),
    readFile(new URL('src/features/customers/types.ts', root), 'utf8'),
  ]);
  const legacyPattern = /@\/lib\/supabase|@\/lib\/woocommerce|@\/lib\/cartContext|NEXT_PUBLIC_SUPABASE\b|createSupabaseAdmin\(\)|createSupabaseServer\(\)/;
  assert.doesNotMatch(queriesSource, legacyPattern);
  assert.doesNotMatch(typesSource, legacyPattern);
  assert.match(queriesSource, /^import 'server-only';/m);
  assert.match(queriesSource, /createInsumosSupabaseAdmin/);
});

test('customers/types.ts: reuses DeliveryMethod/PreferredCarrier/BillingDocumentType/CheckoutShippingAddress from the checkout feature instead of redefining them', async () => {
  const source = await readFile(new URL('src/features/customers/types.ts', root), 'utf8');
  assert.match(source, /import type \{ BillingDocumentType, DeliveryMethod, PreferredCarrier \} from '@\/features\/checkout\/shipping';/);
  assert.match(source, /import type \{ CheckoutShippingAddress \} from '@\/features\/checkout\/types';/);
  assert.doesNotMatch(source, /export type DeliveryMethod|export type PreferredCarrier|export type BillingDocumentType/);
});

// ==========================================================================
// Customer profile Etapa 4: read-only admin UI — /admin/clientes and
// /admin/clientes/[id]. No mutations, no new auth mechanism, no migrations.
// ==========================================================================

test('/admin/clientes and /admin/clientes/[id] are protected by the same requireCatalogManager() gate every other /admin route already uses — no parallel auth mechanism was introduced', async () => {
  const adminLayout = await readFile(new URL('src/app/admin/layout.tsx', root), 'utf8');
  assert.match(adminLayout, /requireCatalogManager/);
  // Confirm the new pages are plain page.tsx files under src/app/admin — the
  // existing layout.tsx wraps every route in this tree automatically, so
  // there is nothing for the new pages themselves to do for page-level auth.
  const [listPage, detailPage] = await Promise.all([
    readFile(new URL('src/app/admin/clientes/page.tsx', root), 'utf8'),
    readFile(new URL('src/app/admin/clientes/[id]/page.tsx', root), 'utf8'),
  ]);
  assert.doesNotMatch(listPage, /requireInsumosRole|requireCatalogManager|requireCustomerManager/);
  assert.doesNotMatch(detailPage, /requireInsumosRole|requireCatalogManager|requireCustomerManager/);
});

test('the customers admin API routes are GET-only (read-only Etapa 4: no POST/PATCH/PUT/DELETE) and rely entirely on listCustomers/getCustomerById/listCustomerOrders for both data and auth — no direct Supabase admin client bypassing those guarded functions', async () => {
  const [listRoute, detailRoute] = await Promise.all([
    readFile(new URL('src/app/api/insumos/admin/customers/route.ts', root), 'utf8'),
    readFile(new URL('src/app/api/insumos/admin/customers/[id]/route.ts', root), 'utf8'),
  ]);
  for (const source of [listRoute, detailRoute]) {
    assert.doesNotMatch(source, /export async function (POST|PATCH|PUT|DELETE)/);
    assert.doesNotMatch(source, /createInsumosSupabaseAdmin|createInsumosSupabaseServer/);
  }
  assert.match(listRoute, /import \{ listCustomers \} from '@\/features\/customers\/server\/queries';/);
  assert.match(detailRoute, /import \{ getCustomerById, listCustomerOrders \} from '@\/features\/customers\/server\/queries';/);
});

test('GET /api/insumos/admin/customers calls listCustomers with search/page/pageSize taken from the request query string — the list UI never re-implements search or pagination filtering itself', async () => {
  const routeSource = await readFile(new URL('src/app/api/insumos/admin/customers/route.ts', root), 'utf8');
  assert.match(routeSource, /const search = searchParams\.get\('search'\) \?\? undefined;/);
  assert.match(routeSource, /await listCustomers\(\{\s*\n\s*search,\s*\n\s*page: pageParam \? Number\(pageParam\) : undefined,\s*\n\s*pageSize: pageSizeParam \? Number\(pageSizeParam\) : undefined,\s*\n\s*\}\);/);

  const listUiSource = await readFile(new URL('src/features/admin/components/CustomerList.tsx', root), 'utf8');
  // The search box sends its term to the API as a query param and lets the
  // backend filter — it must never itself call .filter()/.includes() on the
  // customers it already has in memory (that would be re-implementing the
  // commercial search client-side, which is explicitly forbidden).
  assert.match(listUiSource, /if \(search\) params\.set\('search', search\);/);
  assert.doesNotMatch(listUiSource, /\.filter\(|\.includes\(/);
});

test('CustomerList paginates via page state sent to the API (prev/next, page indicator) rather than slicing an already-fetched full list client-side', async () => {
  const source = await readFile(new URL('src/features/admin/components/CustomerList.tsx', root), 'utf8');
  assert.match(source, /const params = new URLSearchParams\(\{ page: String\(page\), pageSize: String\(PAGE_SIZE\) \}\);/);
  assert.match(source, /setPage\(\(current\) => Math\.max\(1, current - 1\)\)/);
  assert.match(source, /setPage\(\(current\) => Math\.min\(totalPages, current \+ 1\)\)/);
  assert.doesNotMatch(source, /\.slice\(/);
});

test('a customer with no commercial orders renders exactly the spec\'s empty-state numbers: Compras 0, Total gastado $0 (not "—"), Ticket promedio/Primera/Última compra "—"', async () => {
  const listSource = await readFile(new URL('src/features/admin/components/CustomerList.tsx', root), 'utf8');
  const profileSource = await readFile(new URL('src/features/admin/components/CustomerProfile.tsx', root), 'utf8');
  // totalOrders/totalSpent are rendered unconditionally (0 and $0 are real,
  // meaningful values — never coerced to "—" the way the nullable derived
  // dates/averages are).
  assert.match(listSource, /\{customer\.totalOrders\}/);
  assert.match(listSource, /\{formatPrice\(customer\.totalSpent\)\}/);
  assert.doesNotMatch(listSource, /customer\.totalOrders \|\||customer\.totalSpent \|\|/);
  assert.match(profileSource, /\{customer\.totalOrders\}/);
  assert.match(profileSource, /\{formatPrice\(customer\.totalSpent\)\}/);
  // averageOrderValue/first/lastOrderAt are the ones allowed to show "—".
  assert.match(profileSource, /customer\.averageOrderValue === null \? '—' : formatPrice\(customer\.averageOrderValue\)/);
  assert.match(profileSource, /formatDate\(customer\.firstOrderAt\)/);
  assert.match(profileSource, /formatDate\(customer\.lastOrderAt\)/);
});

test('/admin/clientes/[id] fetches the profile from getCustomerById (via the combined API route) — not re-derived from raw order rows in the component', async () => {
  const source = await readFile(new URL('src/features/admin/components/CustomerProfile.tsx', root), 'utf8');
  assert.match(source, /fetch\(`\/api\/insumos\/admin\/customers\/\$\{customerId\}`\)/);
  assert.match(source, /const \{ customer, orders \} = data;/);
});

test('order history uses listCustomerOrders data as-is (full history, every status) and never recalculates totalOrders/totalSpent/averageOrderValue from it — those numbers only ever come from the customer object returned by getCustomerById', async () => {
  const source = await readFile(new URL('src/features/admin/components/CustomerProfile.tsx', root), 'utf8');
  // The only uses of the `orders` array are the empty-state check and the
  // two render lists (desktop table + mobile cards) — never a sum/reduce/
  // count feeding into the KPI cards.
  assert.doesNotMatch(source, /orders\.reduce|orders\.filter\(.*status.*paid|orders\.length ===? \w+\.totalOrders/);
  assert.match(source, /orders\.length === 0/);
  assert.match(source, /orders\.map\(\(order\)/);
});

test('cancelled orders appear in the history table with their own visual status (not hidden, not merged with any other status) but never influence the KPI cards, which come entirely from getCustomerById\'s already-filtered commercial summary', async () => {
  const source = await readFile(new URL('src/features/admin/components/CustomerProfile.tsx', root), 'utf8');
  assert.match(source, /cancelled: 'bg-red-50 text-red-700',/);
  assert.match(source, /cancelled: 'Cancelado',/);
  // All five real order.status values get their own distinct style — none
  // fall through to the generic unstyled default for a status this common.
  for (const status of ['paid', 'fulfilled', 'pending', 'awaiting_payment', 'cancelled']) {
    assert.match(source, new RegExp(`${status}: '[^']+',`));
  }
});

test('null master-data and derived fields render "—" — full name, phone, RUT, and the three most-recent-order preferences never fabricate a value', async () => {
  const source = await readFile(new URL('src/features/admin/components/CustomerProfile.tsx', root), 'utf8');
  assert.match(source, /\{customer\.fullName \|\| '—'\}/);
  assert.match(source, /\{customer\.phoneNormalized \|\| '—'\}/);
  assert.match(source, /\{customer\.rutNormalized \|\| '—'\}/);
  assert.match(source, /customer\.lastDeliveryMethod \? DELIVERY_METHOD_LABELS\[customer\.lastDeliveryMethod\] : '—'/);
  assert.match(source, /customer\.lastPreferredCarrier \? CARRIER_LABELS\[customer\.lastPreferredCarrier\] : '—'/);
  assert.match(source, /customer\.lastBillingDocumentType \? BILLING_DOCUMENT_LABELS\[customer\.lastBillingDocumentType\] : '—'/);

  const listSource = await readFile(new URL('src/features/admin/components/CustomerList.tsx', root), 'utf8');
  assert.match(listSource, /\{customer\.fullName \|\| '—'\}/);
  assert.match(listSource, /\{customer\.phoneNormalized \|\| '—'\}/);
});

test('customers admin components never send a mutating request and never import a mutation function for customers or orders — Etapa 4 is strictly read-only', async () => {
  const [listSource, profileSource] = await Promise.all([
    readFile(new URL('src/features/admin/components/CustomerList.tsx', root), 'utf8'),
    readFile(new URL('src/features/admin/components/CustomerProfile.tsx', root), 'utf8'),
  ]);
  const mutationPattern = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]|createCustomer|updateCustomer|deleteCustomer|createOrder|updateOrder|deleteOrder/;
  assert.doesNotMatch(listSource, mutationPattern);
  assert.doesNotMatch(profileSource, mutationPattern);
});

test('customers admin UI stays isolated from legacy Artesellos: no @/lib/supabase, no NEXT_PUBLIC_SUPABASE, no legacy ProductList/AdminShell chrome imports', async () => {
  const [listSource, profileSource, listRoute, detailRoute] = await Promise.all([
    readFile(new URL('src/features/admin/components/CustomerList.tsx', root), 'utf8'),
    readFile(new URL('src/features/admin/components/CustomerProfile.tsx', root), 'utf8'),
    readFile(new URL('src/app/api/insumos/admin/customers/route.ts', root), 'utf8'),
    readFile(new URL('src/app/api/insumos/admin/customers/[id]/route.ts', root), 'utf8'),
  ]);
  const legacyPattern = /@\/lib\/supabase|@\/lib\/woocommerce|NEXT_PUBLIC_SUPABASE\b/;
  for (const source of [listSource, profileSource, listRoute, detailRoute]) {
    assert.doesNotMatch(source, legacyPattern);
  }
});

test('"Clientes" was added to the existing admin navigation without touching the public site nav', async () => {
  const adminShell = await readFile(new URL('src/features/admin/components/AdminShell.tsx', root), 'utf8');
  assert.match(adminShell, /\{ href: '\/admin\/clientes', label: 'Clientes' \}/);
  const header = await readFile(new URL('src/components/insumos/Header.tsx', root), 'utf8');
  assert.doesNotMatch(header, /\/admin\/clientes/);
});

test('order history translates payment_status to Spanish for display only (pending/approved/rejected/cancelled/refunded), falls back to the raw value for anything unrecognized, and never mutates order.paymentStatus itself', async () => {
  const source = await readFile(new URL('src/features/admin/components/CustomerProfile.tsx', root), 'utf8');
  assert.match(source, /const PAYMENT_STATUS_LABELS: Record<string, string> = \{\s*\n\s*pending: 'Pendiente',\s*\n\s*approved: 'Aprobado',\s*\n\s*rejected: 'Rechazado',\s*\n\s*cancelled: 'Cancelado',\s*\n\s*refunded: 'Reembolsado',/);
  assert.match(source, /function formatPaymentStatus\(paymentStatus: string\): string \{\s*\n\s*return PAYMENT_STATUS_LABELS\[paymentStatus\] \|\| paymentStatus;/);
  // Both render sites (desktop table + mobile card) go through the
  // formatter — neither prints the raw order.paymentStatus directly.
  const renderSites = (source.match(/formatPaymentStatus\(order\.paymentStatus\)/g) || []).length;
  assert.strictEqual(renderSites, 2);
  assert.doesNotMatch(source, /\{order\.paymentStatus\}/);
});

test('the "most recent order" section is titled "Datos del último pedido" (not "Preferencias recientes") to avoid implying a consolidated commercial preference when it may reflect a single cancelled order', async () => {
  const source = await readFile(new URL('src/features/admin/components/CustomerProfile.tsx', root), 'utf8');
  assert.match(source, /Datos del último pedido/);
  assert.match(source, /Información registrada en el pedido más reciente del cliente\./);
  assert.doesNotMatch(source, /Preferencias recientes/);
});

// ==========================================================================
// Customer profile Etapa 5: integración customers <-> checkout. Resolves or
// creates the customers row atomically inside create_pending_order and
// writes orders.buyer_id — same RPC signature as before, no TS changes
// anywhere. Mercado Pago stays untouched/on stand-by.
// ==========================================================================

test('checkout customer identity migration: create_pending_order keeps the exact same signature (10 params, same names/types/defaults, same return table) — no client-side call site needs to change', async () => {
  const sql = await readFile(checkoutCustomerIdentityMigrationPath, 'utf8');
  assert.match(sql, /create or replace function public\.create_pending_order\(\s*\n\s*p_items jsonb,\s*\n\s*p_customer_email text,\s*\n\s*p_customer_name text,\s*\n\s*p_customer_phone text,\s*\n\s*p_shipping_address jsonb,\s*\n\s*p_notes text,\s*\n\s*p_preferred_carrier text,\s*\n\s*p_billing_document_type text default 'boleta',\s*\n\s*p_billing_data jsonb default null,\s*\n\s*p_delivery_method text default 'shipping'\s*\n\)/);
  assert.match(sql, /returns table \(order_id uuid, confirmation_token text, subtotal integer, total integer, shipping_policy text\)/);
});

test('checkout customer identity migration: normalizes email as lower(trim(...)) — the same identity rule normalizeEmail() already uses elsewhere — and never derives identity from name/phone/rut', async () => {
  const sql = await readFile(checkoutCustomerIdentityMigrationPath, 'utf8');
  assert.match(sql, /v_email_normalized := lower\(trim\(p_customer_email\)\);/);
  assert.match(sql, /v_phone_normalized := nullif\(trim\(coalesce\(p_customer_phone, ''\)\), ''\);/);
  const codeOnly = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(codeOnly, /on conflict \(phone_normalized\)|on conflict \(rut_normalized\)|on conflict \(full_name\)/);
});

test('checkout customer identity migration: resolves the customer via INSERT ... ON CONFLICT (email_normalized) DO UPDATE ... RETURNING id — not a SELECT-then-INSERT, which is what makes two concurrent checkouts for the same new email race-safe', async () => {
  const sql = await readFile(checkoutCustomerIdentityMigrationPath, 'utf8');
  assert.match(sql, /insert into public\.customers \(email_normalized, full_name, phone_normalized\)\s*\n\s*values \(v_email_normalized, trim\(p_customer_name\), v_phone_normalized\)\s*\n\s*on conflict \(email_normalized\) do update set/);
  assert.match(sql, /returning id into v_customer_id;/);
  // No prior SELECT into v_customer_id anywhere before the upsert — the
  // resolution mechanism is the upsert itself, not a lookup-then-branch.
  const upsertIndex = sql.indexOf('insert into public.customers');
  const beforeUpsert = sql.slice(0, upsertIndex);
  assert.doesNotMatch(beforeUpsert, /select .*into v_customer_id/i);
});

test('checkout customer identity migration: the UPDATE branch never blanks a valid master value — full_name/phone_normalized fall back to the existing row via coalesce/nullif when the new value is null or empty, and email_normalized itself is never rewritten', async () => {
  const sql = await readFile(checkoutCustomerIdentityMigrationPath, 'utf8');
  assert.match(sql, /full_name = coalesce\(nullif\(trim\(excluded\.full_name\), ''\), public\.customers\.full_name\),/);
  assert.match(sql, /phone_normalized = coalesce\(excluded\.phone_normalized, public\.customers\.phone_normalized\),/);
  assert.match(sql, /updated_at = now\(\)\s*\n\s*returning id into v_customer_id;/);
  const setClauseStart = sql.indexOf('on conflict (email_normalized) do update set');
  const setClauseEnd = sql.indexOf('returning id into v_customer_id', setClauseStart);
  const setClause = sql.slice(setClauseStart, setClauseEnd);
  assert.doesNotMatch(setClause, /email_normalized\s*=/);
});

test('checkout customer identity migration: rut_normalized is never referenced in actual SQL code — only in doc comments explaining it is explicitly out of scope for this stage', async () => {
  const sql = await readFile(checkoutCustomerIdentityMigrationPath, 'utf8');
  const codeOnly = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(codeOnly, /rut_normalized/);
});

test('checkout customer identity migration: the customer upsert runs after all input validation but before the stock-locking loop — so it participates in the same implicit transaction as stock validation and rolls back with it on any later failure, and never touches inventory/reservations', async () => {
  const sql = await readFile(checkoutCustomerIdentityMigrationPath, 'utf8');
  const validationEnd = sql.indexOf("raise exception 'Los datos de facturación son incompletos o inválidos.';");
  const upsertIndex = sql.indexOf('insert into public.customers');
  const stockLoopIndex = sql.indexOf('for rec in');
  assert.ok(validationEnd < upsertIndex, 'customer upsert must come after input validation');
  assert.ok(upsertIndex < stockLoopIndex, 'customer upsert must come before the stock-locking loop');
  const codeOnly = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(codeOnly, /inventory_movements|inventory_reservations\s+set|record_inventory_movement|reserve_order_inventory|release_order_inventory/);
});

test('checkout customer identity migration: orders.buyer_id is added to both the INSERT column list and VALUES (v_customer_id, right after auth.uid()) — orders.customer_id (legacy, still auth.uid()) is otherwise untouched', async () => {
  const sql = await readFile(checkoutCustomerIdentityMigrationPath, 'utf8');
  assert.match(sql, /insert into public\.orders \(\s*\n\s*customer_id, buyer_id, customer_email, customer_name, customer_phone,/);
  assert.match(sql, /\) values \(\s*\n\s*auth\.uid\(\), v_customer_id, trim\(p_customer_email\), trim\(p_customer_name\)/);
});

test('checkout customer identity migration stays out of scope: no confirm_order_paid/confirm_order_payment_reference, no Mercado Pago, no reservation/inventory RPCs, no new grants or RLS policies', async () => {
  const sql = await readFile(checkoutCustomerIdentityMigrationPath, 'utf8');
  const codeOnly = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(codeOnly, /confirm_order_paid|confirm_order_payment_reference|reserve_order_inventory|release_order_inventory|release_order_payment_reservation|mercadopago|payment_reference/i);
  assert.doesNotMatch(sql, /create policy|grant |alter table public\.customers enable row level security/);
});

// ==========================================================================
// Customer profile Etapa 6B: identidad auth.users <-> customers.user_id.
// Índice UNIQUE parcial + RPC claim_customer_for_current_user(), sin
// trigger sobre auth.users, sin RLS de comprador (Etapa 6C), sin tocar
// checkout (Etapa 6G). La identidad viene exclusivamente de auth.uid().
// ==========================================================================

test('customer auth claim migration: creates a partial UNIQUE index on customers.user_id (where user_id is not null) — guarantees at most one customer per auth.users.id while still allowing unlimited unlinked guest customers', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /create unique index if not exists customers_user_id_key\s*\n\s*on public\.customers\(user_id\)\s*\n\s*where user_id is not null;/);
});

test('claim_customer_for_current_user(): takes zero parameters — the client can never pass an email, customer_id, or user_id for this function to trust', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /create or replace function public\.claim_customer_for_current_user\(\)\s*\n\s*returns uuid/);
});

test('claim_customer_for_current_user(): rejects immediately when auth.uid() is null (anonymous session), before touching auth.users or customers', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /v_user_id := auth\.uid\(\);\s*\n\s*if v_user_id is null then\s*\n\s*raise exception 'No autenticado\.';/);
  const authCheckIndex = sql.indexOf("raise exception 'No autenticado.'");
  const authUsersQueryIndex = sql.indexOf('from auth.users');
  assert.ok(authCheckIndex < authUsersQueryIndex, 'the auth.uid() null check must happen before querying auth.users');
});

test('claim_customer_for_current_user(): queries auth.users internally by the resolved auth.uid() — email and email_confirmed_at are never read from a function argument', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /select email, email_confirmed_at into v_email, v_email_confirmed_at\s*\n\s*from auth\.users\s*\n\s*where id = v_user_id;/);
  // No parameter named p_email/p_customer_id/p_user_id exists anywhere to feed this lookup.
  assert.doesNotMatch(sql, /p_email|p_customer_id|p_user_id/);
});

test('claim_customer_for_current_user(): requires a non-empty email AND email_confirmed_at IS NOT NULL — an unconfirmed session must never link/create a customer', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /if coalesce\(length\(trim\(v_email\)\), 0\) = 0 then\s*\n\s*raise exception 'No fue posible verificar tu correo\.';/);
  assert.match(sql, /if v_email_confirmed_at is null then\s*\n\s*raise exception 'Debes confirmar tu correo antes de vincular tu cuenta\.';/);
});

test('claim_customer_for_current_user(): normalizes email as lower(trim(...)) — same semantics as create_pending_order and the Etapa 2 backfill, no incompatible second definition introduced', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /v_email_normalized := lower\(trim\(v_email\)\);/);
});

test('claim_customer_for_current_user(): when auth.uid() already owns a customer, returns the SAME customer id idempotently if the email still matches, and rejects (never fusiona) if it does not', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /select id, email_normalized into v_linked_customer_id, v_linked_email\s*\n\s*from public\.customers\s*\n\s*where user_id = v_user_id;/);
  assert.match(sql, /if v_linked_email = v_email_normalized then\s*\n\s*return v_linked_customer_id;\s*\n\s*else\s*\n\s*raise exception 'Tu cuenta ya está vinculada a otro cliente\.';/);
});

test('claim_customer_for_current_user(): resolves/creates via INSERT ... ON CONFLICT (email_normalized) — not SELECT-then-INSERT — the same concurrency-safe pattern as create_pending_order, and never reassigns an existing user_id (coalesce keeps the original owner)', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /insert into public\.customers \(email_normalized, user_id\)\s*\n\s*values \(v_email_normalized, v_user_id\)\s*\n\s*on conflict \(email_normalized\) do update set\s*\n\s*user_id = coalesce\(public\.customers\.user_id, excluded\.user_id\),/);
  assert.match(sql, /returning id, user_id into v_customer_id, v_result_user_id;/);
});

test('claim_customer_for_current_user(): rejects (never reasigna) when the email-matched customer already belongs to a different auth.uid() — checked AFTER the upsert by comparing the returned owner against the caller', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /if v_result_user_id is distinct from v_user_id then\s*\n\s*raise exception 'Este correo ya pertenece a otra cuenta\.';/);
});

test('claim_customer_for_current_user(): EXECUTE is revoked from public/anon and granted only to authenticated — an anonymous request must be denied by Postgres itself, before any function logic runs', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /revoke execute on function public\.claim_customer_for_current_user\(\) from public;/);
  assert.match(sql, /revoke execute on function public\.claim_customer_for_current_user\(\) from anon;/);
  assert.match(sql, /grant execute on function public\.claim_customer_for_current_user\(\) to authenticated;/);
  // No grant to anon anywhere in the file.
  assert.doesNotMatch(sql, /grant execute[^;]*to anon/);
});

test('claim_customer_for_current_user(): uses SECURITY DEFINER with an explicit search_path=public — same hardening convention as every other SECURITY DEFINER function in this project (has_role, create_pending_order, etc.)', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  assert.match(sql, /language plpgsql\s*\nsecurity definer\s*\nset search_path = public\s*\nas \$\$/);
});

test('customer auth claim migration deliberately creates NO trigger on auth.users — the app calls claim_customer_for_current_user() explicitly after a real session exists, works identically for brand-new signups and already-confirmed pre-existing users', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  const codeOnly = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(codeOnly, /create trigger[^;]*auth\.users|on_auth_user_created|after insert on auth\.users|after update of email_confirmed_at/i);
});

test('customer auth claim migration stays out of scope: no RLS policy changes on customers/orders/order_items (Etapa 6C), no changes to create_pending_order or any checkout/payment/inventory RPC (Etapa 6G / Etapa 5 stays closed)', async () => {
  const sql = await readFile(customerAuthClaimMigrationPath, 'utf8');
  const codeOnly = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(codeOnly, /create policy|alter table public\.(customers|orders|order_items) enable row level security/);
  assert.doesNotMatch(codeOnly, /create or replace function public\.create_pending_order|confirm_order_paid|confirm_order_payment_reference|reserve_order_inventory|release_order_inventory|release_order_payment_reservation|mercadopago/i);
});

// ==========================================================================
// Customer profile Etapa 6C: RLS de comprador. Políticas SELECT aditivas
// que autorizan exclusivamente vía auth.uid() -> customers.user_id ->
// customers.id -> orders.buyer_id -> order_items.order_id. Sin trigger,
// sin INSERT/UPDATE/DELETE de comprador, sin tocar checkout ni Etapa 5/6B.
// ==========================================================================

test('buyer RLS migration: customers SELECT policy authorizes via user_id = auth.uid() — never by email or any other column', async () => {
  const sql = await readFile(buyerRlsMigrationPath, 'utf8');
  assert.match(sql, /create policy "buyers read own customer row" on public\.customers\s*\n\s*for select using \(user_id = auth\.uid\(\)\);/);
});

test('buyer RLS migration: orders SELECT policy chains through customers.id = orders.buyer_id AND customers.user_id = auth.uid() — never through orders.customer_email or orders.customer_id', async () => {
  const sql = await readFile(buyerRlsMigrationPath, 'utf8');
  assert.match(sql, /create policy "buyers read own orders" on public\.orders\s*\n\s*for select using \(\s*\n\s*exists \(\s*\n\s*select 1 from public\.customers c\s*\n\s*where c\.id = orders\.buyer_id and c\.user_id = auth\.uid\(\)\s*\n\s*\)\s*\n\s*\);/);
  const policyBlock = sql.slice(sql.indexOf('"buyers read own orders"'), sql.indexOf('"buyers read own order items"'));
  assert.doesNotMatch(policyBlock, /customer_email|customer_id/);
});

test('buyer RLS migration: order_items SELECT policy chains order_items.order_id -> orders.buyer_id -> customers.user_id = auth.uid() — knowing an order_id alone is not enough', async () => {
  const sql = await readFile(buyerRlsMigrationPath, 'utf8');
  assert.match(sql, /create policy "buyers read own order items" on public\.order_items\s*\n\s*for select using \(\s*\n\s*exists \(\s*\n\s*select 1 from public\.orders o\s*\n\s*join public\.customers c on c\.id = o\.buyer_id\s*\n\s*where o\.id = order_items\.order_id and c\.user_id = auth\.uid\(\)\s*\n\s*\)\s*\n\s*\);/);
});

test('buyer RLS migration: adds exactly 3 new policies, all SELECT-only — no INSERT/UPDATE/DELETE/ALL policy is introduced for the buyer', async () => {
  const sql = await readFile(buyerRlsMigrationPath, 'utf8');
  const policyMatches = sql.match(/create policy "buyers[^"]*"/g) || [];
  assert.strictEqual(policyMatches.length, 3, 'exactly customers + orders + order_items buyer policies');
  for (const match of policyMatches) {
    const start = sql.indexOf(match);
    const statementEnd = sql.indexOf(';', start);
    const statement = sql.slice(start, statementEnd);
    assert.match(statement, /for select/, `${match} must be a SELECT-only policy`);
  }
  assert.doesNotMatch(sql, /for insert|for update|for delete|for all/i);
});

test('buyer RLS migration is purely additive: the legacy customer_id-based policies and the admin/staff ALL policies are never referenced/altered/dropped — no DROP POLICY, no ALTER POLICY anywhere', async () => {
  const sql = await readFile(buyerRlsMigrationPath, 'utf8');
  assert.doesNotMatch(sql, /drop policy|alter policy/i);
  const codeOnly = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(codeOnly, /"customers read own orders"|"customers read own order items"|"catalog managers manage/);
});

test('buyer RLS migration stays out of scope: no trigger, no grant/revoke statements (authenticated already has table-level SELECT by default), no changes to create_pending_order or claim_customer_for_current_user', async () => {
  const sql = await readFile(buyerRlsMigrationPath, 'utf8');
  const codeOnly = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(codeOnly, /create trigger|grant |revoke /i);
  assert.doesNotMatch(codeOnly, /create or replace function/i);
});

test('regression guard: the original legacy orders/order_items policies (orders.customer_id = auth.uid()) still live untouched in the foundation migration — Etapa 6C never edited that file', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /create policy "customers read own orders" on public\.orders for select using \(customer_id = auth\.uid\(\) or public\.has_role\('admin'\) or public\.has_role\('staff'\)\);/);
  assert.match(sql, /create policy "customers read own order items" on public\.order_items for select using \(exists \(select 1 from public\.orders where orders\.id = order_items\.order_id and orders\.customer_id = auth\.uid\(\)\) or public\.has_role\('admin'\) or public\.has_role\('staff'\)\);/);
});

// ==========================================================================
// Customer profile Etapa 6D: storefront buyer authentication — signup,
// login (+ claim), logout, requireBuyerAccount(), and the /mi-cuenta guard.
// No dashboard yet (6E/6F), no RLS changes (6C stays as approved), no
// checkout changes (6G). All structural checks strip comments first to
// avoid the recurring false-positive-comment bug from earlier stages.
// ==========================================================================

const loginFormPath = new URL('src/features/auth/components/LoginForm.tsx', root);
const signupFormPath = new URL('src/features/auth/components/SignupForm.tsx', root);
const signOutButtonPath = new URL('src/features/auth/components/SignOutButton.tsx', root);
const authorizationPath = new URL('src/features/auth/server/authorization.ts', root);
const iniciarSesionPagePath = new URL('src/app/iniciar-sesion/page.tsx', root);
const crearCuentaPagePath = new URL('src/app/crear-cuenta/page.tsx', root);
const authCallbackRoutePath = new URL('src/app/auth/callback/route.ts', root);
const miCuentaLayoutPath = new URL('src/app/mi-cuenta/layout.tsx', root);
const miCuentaPagePath = new URL('src/app/mi-cuenta/page.tsx', root);
const clientProvidersPath = new URL('src/components/ClientProviders.tsx', root);
const headerPath = new URL('src/components/insumos/Header.tsx', root);

const insumosRoutesPath = new URL('src/lib/insumosRoutes.ts', root);

test('buyer routes are registered as INSUMOS routes (get the storefront header/footer) and are never treated as admin routes (which get bare chrome)', async () => {
  const [routesSql, providersSql] = await Promise.all([
    readFile(insumosRoutesPath, 'utf8'),
    readFile(clientProvidersPath, 'utf8'),
  ]);
  assert.match(routesSql, /pathname\.startsWith\("\/iniciar-sesion"\)/);
  assert.match(routesSql, /pathname\.startsWith\("\/crear-cuenta"\)/);
  assert.match(routesSql, /pathname\.startsWith\("\/mi-cuenta"\)/);
  // isAdminRoute() in ClientProviders only ever matched /admin and
  // /acceso-admin before this stage and must still only match those.
  const codeOnly = providersSql.replace(/\/\/[^\n]*/g, '');
  assert.match(codeOnly, /pathname\.startsWith\('\/admin'\) \|\| pathname\.startsWith\('\/acceso-admin'\)/);
  assert.doesNotMatch(codeOnly, /pathname\.startsWith\('\/iniciar-sesion'\)|pathname\.startsWith\('\/crear-cuenta'\)|pathname\.startsWith\('\/mi-cuenta'\)/);
});

test('LoginForm and SignupForm both use createInsumosSupabaseBrowser() — the INSUMOS-only browser client — never the legacy Artesellos @/lib/supabase client', async () => {
  const [loginSrc, signupSrc] = await Promise.all([
    readFile(loginFormPath, 'utf8'),
    readFile(signupFormPath, 'utf8'),
  ]);
  for (const source of [loginSrc, signupSrc]) {
    assert.match(source, /import \{ createInsumosSupabaseBrowser \} from '@\/features\/shared\/client\/supabase';/);
    assert.doesNotMatch(source, /@\/lib\/supabase\b/);
  }
});

test('LoginForm calls claim_customer_for_current_user() immediately after signInWithPassword() succeeds, with no arguments — identity comes only from the session, never a client-supplied email/customer id', async () => {
  const source = await readFile(loginFormPath, 'utf8');
  const signInIndex = source.indexOf('signInWithPassword');
  const claimIndex = source.indexOf("rpc('claim_customer_for_current_user')");
  assert.ok(signInIndex >= 0 && claimIndex > signInIndex, 'claim must be called after sign-in, in that order');
  assert.match(source, /supabase\.rpc\('claim_customer_for_current_user'\)/);
  // No parentheses content — no object/args passed to the RPC call.
  assert.doesNotMatch(source, /rpc\('claim_customer_for_current_user',\s*\{/);
});

test('claim_customer_for_current_user() is never reimplemented in TypeScript — no direct .update()/.from(\'customers\') write touching user_id anywhere in the new auth code', async () => {
  const files = await Promise.all(
    [loginFormPath, signupFormPath, authCallbackRoutePath, authorizationPath, iniciarSesionPagePath, crearCuentaPagePath, miCuentaLayoutPath, miCuentaPagePath]
      .map((p) => readFile(p, 'utf8'))
  );
  for (const source of files) {
    assert.doesNotMatch(source, /\.update\(\s*\{[^}]*user_id/s);
    assert.doesNotMatch(source, /\.from\(['"]customers['"]\)\s*\.(insert|update|upsert|delete)\(/);
  }
});

test('requireBuyerAccount() resolves identity exclusively via customers.user_id = auth.uid() — never via user_roles or has_role(\'customer\'), and never accepts an email/id argument', async () => {
  const source = await readFile(authorizationPath, 'utf8');
  const fnStart = source.indexOf('export async function requireBuyerAccount()');
  assert.ok(fnStart >= 0, 'requireBuyerAccount must take zero parameters');
  const fnBody = source.slice(fnStart, source.indexOf('\n}', fnStart));
  assert.match(fnBody, /auth\.getUser\(\)/);
  assert.doesNotMatch(fnBody, /user_roles|has_role/);
});

test('resolveBuyerSessionForAuthPages() calls claim_customer_for_current_user() at most once per invocation (no retry loop) — used only by /iniciar-sesion and /crear-cuenta to avoid a redirect loop with /mi-cuenta\'s guard', async () => {
  const source = await readFile(authorizationPath, 'utf8');
  const fnStart = source.indexOf('export async function resolveBuyerSessionForAuthPages()');
  const fnBody = source.slice(fnStart, source.indexOf('\nexport ', fnStart + 1) === -1 ? source.length : source.indexOf('\nexport ', fnStart + 1));
  const claimCalls = (fnBody.match(/\.rpc\('claim_customer_for_current_user'\)/g) || []).length;
  assert.strictEqual(claimCalls, 1, 'exactly one claim attempt per call — no loop');
});

test('SignOutButton calls supabase.auth.signOut() and navigates away — a real logout, not just a UI state reset', async () => {
  const source = await readFile(signOutButtonPath, 'utf8');
  assert.match(source, /createInsumosSupabaseBrowser\(\)\.auth\.signOut\(\)/);
  assert.match(source, /router\.replace\('\/'\)/);
});

test('/mi-cuenta/layout.tsx protects the route with requireBuyerAccount() and redirects to /iniciar-sesion on failure — the same guard pattern as admin/layout.tsx, but never importing requireCatalogManager/requireCustomerManager', async () => {
  const source = await readFile(miCuentaLayoutPath, 'utf8');
  assert.match(source, /await requireBuyerAccount\(\)/);
  assert.match(source, /redirect\('\/iniciar-sesion'\)/);
  assert.doesNotMatch(source, /requireCatalogManager|requireCustomerManager/);
});

test('/mi-cuenta page is a genuinely minimal MVP: renders account name/email and a sign-out control, with no KPI/order-history/order-detail/profile-editing UI (that belongs to 6E/6F)', async () => {
  const source = await readFile(miCuentaPagePath, 'utf8');
  assert.match(source, /requireBuyerAccount\(\)/);
  assert.match(source, /SignOutButton/);
  assert.doesNotMatch(source, /totalOrders|totalSpent|averageOrderValue|listCustomerOrders|OrderStatusBadge/);
});

test('auth pages and components never mention admin/staff/catalog-manager language — the buyer experience stays fully separate from the admin one', async () => {
  const files = await Promise.all(
    [loginFormPath, signupFormPath, iniciarSesionPagePath, crearCuentaPagePath, miCuentaPagePath]
      .map((p) => readFile(p, 'utf8'))
  );
  for (const source of files) {
    assert.doesNotMatch(source, /\badmin\b|\bstaff\b|catalog manager/i);
  }
});

test('/auth/callback uses createInsumosSupabaseServer() — the INSUMOS session-aware server client — never the legacy Artesellos client, and never service_role', async () => {
  const source = await readFile(authCallbackRoutePath, 'utf8');
  assert.match(source, /import \{ createInsumosSupabaseServer \} from '@\/features\/shared\/server\/supabase';/);
  assert.doesNotMatch(source, /@\/lib\/supabase\b/);
  assert.doesNotMatch(source, /createInsumosSupabaseAdmin|service_role/i);
});

test('/auth/callback: exchangeCodeForSession(code) happens strictly before the claim RPC call — the session must exist before identity resolution is attempted', async () => {
  const source = await readFile(authCallbackRoutePath, 'utf8');
  const exchangeIndex = source.indexOf('exchangeCodeForSession(code)');
  const claimIndex = source.indexOf("rpc('claim_customer_for_current_user')");
  assert.ok(exchangeIndex >= 0 && claimIndex > exchangeIndex, 'claim must be called after the code exchange, in that order');
});

test('/auth/callback calls claim_customer_for_current_user() with no arguments — same rule as LoginForm, identity comes only from the session just established', async () => {
  const source = await readFile(authCallbackRoutePath, 'utf8');
  assert.match(source, /supabase\.rpc\('claim_customer_for_current_user'\)/);
  assert.doesNotMatch(source, /rpc\('claim_customer_for_current_user',\s*\{/);
});

test('/auth/callback: claim success is what gates the /mi-cuenta redirect — a failed claim redirects to /iniciar-sesion instead, never granting access to /mi-cuenta on an unlinked session (no more unconditional redirect after exchange)', async () => {
  const source = await readFile(authCallbackRoutePath, 'utf8');
  // if (claimError) { ... redirect to /iniciar-sesion ... } — and only
  // AFTER that block, unconditionally, the /mi-cuenta success redirect.
  assert.match(
    source,
    /const \{ error: claimError \} = await supabase\.rpc\('claim_customer_for_current_user'\);\s*\n\s*if \(claimError\) \{\s*\n(?:[^\n]*\n)*?\s*return NextResponse\.redirect\(`\$\{origin\}\/iniciar-sesion`\);\s*\n\s*\}\s*\n\s*\n\s*return NextResponse\.redirect\(`\$\{origin\}\/mi-cuenta`\);/
  );
});

test('/auth/callback: missing code or a failed exchangeCodeForSession both redirect to /iniciar-sesion without ever calling claim — no attempt to resolve identity from an unverified/nonexistent session, no internal error details exposed', async () => {
  const source = await readFile(authCallbackRoutePath, 'utf8');
  assert.match(source, /if \(!code\) \{\s*\n\s*return NextResponse\.redirect\(`\$\{origin\}\/iniciar-sesion`\);/);
  const exchangeIndex = source.indexOf('exchangeCodeForSession(code)');
  const claimIndex = source.indexOf("rpc('claim_customer_for_current_user')");
  const betweenExchangeAndClaim = source.slice(exchangeIndex, claimIndex);
  assert.match(betweenExchangeAndClaim, /if \(exchangeError\) \{\s*\n\s*return NextResponse\.redirect\(`\$\{origin\}\/iniciar-sesion`\);/);
  // No raw error message/object ever gets interpolated into a response.
  assert.doesNotMatch(source, /exchangeError\.message|claimError\.message|JSON\.stringify\(.*[Ee]rror/);
});

// Live click-through of a real confirmation email remains untested end-to-end:
// the Supabase project's configured Redirect URLs only allow the fixed Site
// URL (not this environment's dynamically-assigned dev port), and the
// Browser pane sandboxing blocks navigating to Supabase's own external
// /auth/v1/verify endpoint. This was verified instead by code review against
// the standard @supabase/ssr PKCE pattern, plus the structural tests above.
// Documented rather than pretending a real email click was exercised.

test('regression guard: requireCatalogManager/requireCustomerManager/requireInsumosRole in authorization.ts are byte-identical to before Etapa 6D — only new functions were appended, nothing admin-related was edited', async () => {
  const source = await readFile(authorizationPath, 'utf8');
  assert.match(source, /export async function requireInsumosRole\(allowedRoles: AppRole\[\]\) \{\s*\n\s*const supabase = await createInsumosSupabaseServer\(\);\s*\n\s*const \{ data: \{ user \}, error: userError \} = await supabase\.auth\.getUser\(\);\s*\n\s*if \(userError \|\| !user\) throw new Error\('No autenticado\.'\);/);
  assert.match(source, /export const requireCatalogManager = \(\) => requireInsumosRole\(\['admin', 'staff'\]\);/);
  assert.match(source, /export const requireCustomerManager = \(\) => requireInsumosRole\(\['admin', 'staff'\]\);/);
});

test('Header shows session-aware buyer links ("Iniciar sesión"/"Crear cuenta" when logged out, "Mi cuenta" when logged in) instead of the old disabled "Cuenta (próximamente)" placeholder', async () => {
  const source = await readFile(headerPath, 'utf8');
  assert.doesNotMatch(source, /Cuenta \(próximamente\)/);
  assert.match(source, /href=\{hasSession \? '\/mi-cuenta' : '\/iniciar-sesion'\}/);
  assert.match(source, /href="\/crear-cuenta"/);
});
