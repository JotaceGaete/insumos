import type { CatalogCategory, CatalogProduct, ProductVariant } from '../types';
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
  unit_label: string | null; quantity_value: number | null; retail_price: number; stock_quantity: number;
  low_stock_threshold: number; min_quantity: number; max_quantity: number | null; is_active: boolean;
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
  attributes: row.attributes || {}, unitLabel: row.unit_label, quantityValue: row.quantity_value,
  retailPrice: row.retail_price, stockQuantity: row.stock_quantity, lowStockThreshold: row.low_stock_threshold,
  minQuantity: row.min_quantity, maxQuantity: row.max_quantity, isActive: row.is_active,
});

export async function listCatalogCategories(): Promise<CatalogCategory[]> {
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order').order('name');
  if (error) throw error;
  return ((data || []) as CategoryRow[]).map(mapCategory);
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
