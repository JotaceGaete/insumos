import type { CatalogCategory, CatalogProduct, ProductMedia, ProductVariant } from '../types';
import { createInsumosSupabaseServer } from '@/features/shared/server/supabase';

type CategoryRow = {
  id: string; parent_id: string | null; name: string; slug: string; description: string | null;
  image_path: string | null; sort_order: number; is_active: boolean;
};

type ProductRow = {
  id: string; name: string; slug: string; short_description: string | null; description: string | null;
  status: CatalogProduct['status']; is_featured: boolean; category_id: string | null; brand: string | null;
  seo_title: string | null; seo_description: string | null;
};

type VariantRow = {
  id: string; product_id: string; sku: string; name: string; attributes: Record<string, string> | null;
  option_value: string | null; unit: string | null; quantity_value: number | null; retail_price: number;
  wholesale_price: number | null; cost_price: number | null; stock_quantity: number; low_stock_threshold: number;
  weight_grams: number | null; min_quantity: number; max_quantity: number | null; is_active: boolean;
};

type ProductMediaRow = {
  id: string; product_id: string; variant_id: string | null; storage_path: string; alt_text: string | null;
  sort_order: number; is_primary: boolean;
};

const mapCategory = (row: CategoryRow): CatalogCategory => ({
  id: row.id, parentId: row.parent_id, name: row.name, slug: row.slug,
  description: row.description, imagePath: row.image_path, sortOrder: row.sort_order, isActive: row.is_active,
});

const mapProduct = (row: ProductRow): CatalogProduct => ({
  id: row.id, name: row.name, slug: row.slug, shortDescription: row.short_description,
  description: row.description, status: row.status, isFeatured: row.is_featured,
  categoryId: row.category_id, brand: row.brand, seoTitle: row.seo_title, seoDescription: row.seo_description,
});

const mapVariant = (row: VariantRow): ProductVariant => ({
  id: row.id, productId: row.product_id, sku: row.sku, name: row.name,
  optionValue: row.option_value, attributes: row.attributes || {}, unit: row.unit, quantityValue: row.quantity_value,
  retailPrice: row.retail_price, wholesalePrice: row.wholesale_price, costPrice: row.cost_price,
  stockQuantity: row.stock_quantity, lowStockThreshold: row.low_stock_threshold, weightGrams: row.weight_grams,
  minQuantity: row.min_quantity, maxQuantity: row.max_quantity, isActive: row.is_active,
});

const mapProductMedia = (row: ProductMediaRow): ProductMedia => ({
  id: row.id, productId: row.product_id, variantId: row.variant_id, storagePath: row.storage_path,
  altText: row.alt_text, sortOrder: row.sort_order, isPrimary: row.is_primary,
});

export type CatalogProductListing = {
  product: CatalogProduct;
  category: CatalogCategory | null;
  variants: ProductVariant[];
  media: ProductMedia[];
};

export async function listCatalogCategories(): Promise<CatalogCategory[]> {
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order').order('name');
  if (error) throw error;
  return ((data || []) as CategoryRow[]).map(mapCategory);
}

export type CatalogCategoryWithCount = CatalogCategory & { productCount: number };

/**
 * Lightweight companion to listCatalogCategories for the homepage category grid:
 * only the category rows plus a per-category active product count, without the
 * heavier variants/media joins that listCatalogProductListings performs.
 */
export async function listCatalogCategoriesWithCounts(): Promise<CatalogCategoryWithCount[]> {
  const supabase = await createInsumosSupabaseServer();
  const [categories, { data: productRows, error }] = await Promise.all([
    listCatalogCategories(),
    supabase.from('products').select('category_id').eq('status', 'active'),
  ]);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (productRows || []) as Array<{ category_id: string | null }>) {
    if (!row.category_id) continue;
    counts.set(row.category_id, (counts.get(row.category_id) || 0) + 1);
  }

  return categories.map((category) => ({ ...category, productCount: counts.get(category.id) || 0 }));
}

export async function getCatalogProduct(slug: string): Promise<CatalogProduct | null> {
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase.from('products').select('*').eq('slug', slug).eq('status', 'active').maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data as ProductRow) : null;
}

export async function listProductVariants(productId: string): Promise<ProductVariant[]> {
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase.from('product_variants').select('*').eq('product_id', productId).eq('is_active', true).order('sort_order');
  if (error) throw error;
  return ((data || []) as VariantRow[]).map(mapVariant);
}

export async function getCatalogCategory(slug: string): Promise<CatalogCategory | null> {
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCategory(data as CategoryRow) : null;
}

/**
 * Public listing data comes only from the insumos schema. Variant rows remain
 * the authority for price and stock; products do not carry either value.
 */
export async function listCatalogProductListings(): Promise<CatalogProductListing[]> {
  const supabase = await createInsumosSupabaseServer();
  const { data: productRows, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .order('name');

  if (productsError) throw productsError;

  const products = ((productRows || []) as ProductRow[]).map(mapProduct);
  if (products.length === 0) return [];

  const productIds = products.map((product) => product.id);
  const [{ data: variantRows, error: variantsError }, { data: mediaRows, error: mediaError }, categories] = await Promise.all([
    supabase.from('product_variants').select('*').in('product_id', productIds).eq('is_active', true).order('sort_order'),
    supabase.from('product_media').select('*').in('product_id', productIds).order('is_primary', { ascending: false }).order('sort_order'),
    listCatalogCategories(),
  ]);

  if (variantsError) throw variantsError;
  if (mediaError) throw mediaError;

  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const row of (variantRows || []) as VariantRow[]) {
    const variant = mapVariant(row);
    variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) || []), variant]);
  }

  const mediaByProduct = new Map<string, ProductMedia[]>();
  for (const row of (mediaRows || []) as ProductMediaRow[]) {
    const media = mapProductMedia(row);
    mediaByProduct.set(media.productId, [...(mediaByProduct.get(media.productId) || []), media]);
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  return products.map((product) => ({
    product,
    category: product.categoryId ? categoriesById.get(product.categoryId) || null : null,
    variants: variantsByProduct.get(product.id) || [],
    media: mediaByProduct.get(product.id) || [],
  }));
}

export async function getCatalogProductListing(slug: string): Promise<CatalogProductListing | null> {
  const product = await getCatalogProduct(slug);
  if (!product) return null;

  const supabase = await createInsumosSupabaseServer();
  const [{ data: categoryRow, error: categoryError }, { data: variantRows, error: variantsError }, { data: mediaRows, error: mediaError }] = await Promise.all([
    product.categoryId ? supabase.from('categories').select('*').eq('id', product.categoryId).eq('is_active', true).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from('product_variants').select('*').eq('product_id', product.id).eq('is_active', true).order('sort_order'),
    supabase.from('product_media').select('*').eq('product_id', product.id).order('is_primary', { ascending: false }).order('sort_order'),
  ]);

  if (categoryError) throw categoryError;
  if (variantsError) throw variantsError;
  if (mediaError) throw mediaError;

  return {
    product,
    category: categoryRow ? mapCategory(categoryRow as CategoryRow) : null,
    variants: ((variantRows || []) as VariantRow[]).map(mapVariant),
    media: ((mediaRows || []) as ProductMediaRow[]).map(mapProductMedia),
  };
}
