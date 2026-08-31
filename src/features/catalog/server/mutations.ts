import 'server-only';
import { requireCatalogManager } from '@/features/auth/server/authorization';
import { createInsumosSupabaseAdmin, createInsumosSupabaseServer } from '@/features/shared/server/supabase';
import type { ProductStatus } from '../types';
import type { InventoryMovementType } from '../types';
import { assertInventoryMovementConvention } from '@/features/inventory/movementRules';
import { slugify } from '../slug';

export interface CategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
  description?: string | null;
  imagePath?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ProductInput {
  name: string;
  slug: string;
  categoryId?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  status?: ProductStatus;
  isFeatured?: boolean;
  brand?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface VariantInput {
  productId: string;
  sku: string;
  name: string;
  optionValue?: string | null;
  attributes?: Record<string, string>;
  unit?: string | null;
  quantityValue?: number | null;
  retailPrice: number;
  wholesalePrice?: number | null;
  costPrice?: number | null;
  initialStock?: number;
  lowStockThreshold?: number;
  weightGrams?: number | null;
  minQuantity?: number;
  maxQuantity?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

function assertText(value: string, field: string) {
  if (!value?.trim()) throw new Error(`${field} es obligatorio.`);
}

function assertPrice(value: number) {
  if (!Number.isInteger(value) || value < 0) throw new Error('El precio debe ser un entero no negativo en CLP.');
}

function assertOptionalPrice(value: number | null | undefined, field: string) {
  if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new Error(`${field} debe ser un entero no negativo en CLP.`);
  }
}

function assertVariantQuantities(input: Pick<VariantInput, 'quantityValue' | 'lowStockThreshold' | 'minQuantity' | 'maxQuantity' | 'weightGrams'>) {
  if (input.quantityValue !== undefined && input.quantityValue !== null && input.quantityValue <= 0) {
    throw new Error('El formato de la variante debe ser mayor a cero.');
  }
  if (input.lowStockThreshold !== undefined && (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0)) {
    throw new Error('El umbral de stock bajo debe ser un entero no negativo.');
  }
  if (input.minQuantity !== undefined && (!Number.isInteger(input.minQuantity) || input.minQuantity <= 0)) {
    throw new Error('La cantidad mínima debe ser un entero positivo.');
  }
  if (input.maxQuantity !== undefined && input.maxQuantity !== null && (!Number.isInteger(input.maxQuantity) || input.maxQuantity <= 0)) {
    throw new Error('La cantidad máxima debe ser un entero positivo o quedar vacía.');
  }
  if (input.minQuantity !== undefined && input.maxQuantity !== undefined && input.maxQuantity !== null && input.maxQuantity < input.minQuantity) {
    throw new Error('La cantidad máxima no puede ser menor a la mínima.');
  }
  if (input.weightGrams !== undefined && input.weightGrams !== null && (!Number.isInteger(input.weightGrams) || input.weightGrams < 0)) {
    throw new Error('El peso debe ser un entero no negativo en gramos o quedar vacío.');
  }
}

export async function createCategory(input: CategoryInput) {
  await requireCatalogManager();
  assertText(input.name, 'Nombre');
  const slug = slugify(input.slug?.trim() ? input.slug : input.name);
  assertText(slug, 'Slug');
  const admin = createInsumosSupabaseAdmin();
  const { data, error } = await admin.from('categories').insert({
    name: input.name.trim(), slug, parent_id: input.parentId || null,
    description: input.description || null, image_path: input.imagePath || null,
    sort_order: input.sortOrder || 0, is_active: input.isActive !== false,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, input: Partial<CategoryInput>) {
  await requireCatalogManager();
  const admin = createInsumosSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) { assertText(input.name, 'Nombre'); patch.name = input.name.trim(); }
  if (input.slug !== undefined) { const slug = slugify(input.slug); assertText(slug, 'Slug'); patch.slug = slug; }
  if (input.parentId !== undefined) patch.parent_id = input.parentId;
  if (input.description !== undefined) patch.description = input.description;
  if (input.imagePath !== undefined) patch.image_path = input.imagePath;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  const { data, error } = await admin.from('categories').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string) {
  await requireCatalogManager();
  const { error } = await createInsumosSupabaseAdmin().from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function createProduct(input: ProductInput) {
  await requireCatalogManager();
  assertText(input.name, 'Nombre');
  const slug = slugify(input.slug?.trim() ? input.slug : input.name);
  assertText(slug, 'Slug');
  const admin = createInsumosSupabaseAdmin();
  const { data, error } = await admin.from('products').insert({
    name: input.name.trim(), slug, category_id: input.categoryId || null,
    short_description: input.shortDescription || null, description: input.description || null,
    status: input.status || 'draft', is_featured: input.isFeatured === true, brand: input.brand || null,
    seo_title: input.seoTitle || null, seo_description: input.seoDescription || null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  await requireCatalogManager();
  const admin = createInsumosSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) { assertText(input.name, 'Nombre'); patch.name = input.name.trim(); }
  if (input.slug !== undefined) { const slug = slugify(input.slug); assertText(slug, 'Slug'); patch.slug = slug; }
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.shortDescription !== undefined) patch.short_description = input.shortDescription;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;
  if (input.brand !== undefined) patch.brand = input.brand;
  if (input.seoTitle !== undefined) patch.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) patch.seo_description = input.seoDescription;
  const { data, error } = await admin.from('products').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string) {
  await requireCatalogManager();
  const { error } = await createInsumosSupabaseAdmin().from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function createVariant(input: VariantInput) {
  await requireCatalogManager();
  assertText(input.productId, 'Producto');
  assertText(input.sku, 'SKU');
  assertText(input.name, 'Nombre de variante');
  assertPrice(input.retailPrice);
  assertOptionalPrice(input.wholesalePrice, 'El precio mayorista');
  assertOptionalPrice(input.costPrice, 'El costo');
  assertVariantQuantities(input);
  const admin = createInsumosSupabaseAdmin();
  const { data, error } = await admin.from('product_variants').insert({
    product_id: input.productId, sku: input.sku.trim(), name: input.name.trim(), option_value: input.optionValue || null,
    attributes: input.attributes || {}, unit: input.unit || null, quantity_value: input.quantityValue || null,
    retail_price: input.retailPrice, wholesale_price: input.wholesalePrice ?? null, cost_price: input.costPrice ?? null,
    stock_quantity: 0, low_stock_threshold: input.lowStockThreshold || 0, min_quantity: input.minQuantity || 1,
    max_quantity: input.maxQuantity || null, weight_grams: input.weightGrams ?? null,
    is_active: input.isActive !== false, sort_order: input.sortOrder || 0,
  }).select().single();
  if (error) throw error;
  if (input.initialStock && input.initialStock > 0) {
    await recordInventoryMovement(data.id, input.initialStock, 'initial', 'initial_stock', null, 'Stock inicial');
  }
  return data;
}

export async function updateVariant(id: string, input: Partial<Omit<VariantInput, 'productId' | 'initialStock'>>) {
  await requireCatalogManager();
  assertVariantQuantities(input);
  const admin = createInsumosSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (input.sku !== undefined) { assertText(input.sku, 'SKU'); patch.sku = input.sku.trim(); }
  if (input.name !== undefined) { assertText(input.name, 'Nombre de variante'); patch.name = input.name.trim(); }
  if (input.optionValue !== undefined) patch.option_value = input.optionValue;
  if (input.attributes !== undefined) patch.attributes = input.attributes;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.quantityValue !== undefined) patch.quantity_value = input.quantityValue;
  if (input.retailPrice !== undefined) { assertPrice(input.retailPrice); patch.retail_price = input.retailPrice; }
  if (input.wholesalePrice !== undefined) { assertOptionalPrice(input.wholesalePrice, 'El precio mayorista'); patch.wholesale_price = input.wholesalePrice; }
  if (input.costPrice !== undefined) { assertOptionalPrice(input.costPrice, 'El costo'); patch.cost_price = input.costPrice; }
  if (input.lowStockThreshold !== undefined) patch.low_stock_threshold = input.lowStockThreshold;
  if (input.weightGrams !== undefined) patch.weight_grams = input.weightGrams;
  if (input.minQuantity !== undefined) patch.min_quantity = input.minQuantity;
  if (input.maxQuantity !== undefined) patch.max_quantity = input.maxQuantity;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { data, error } = await admin.from('product_variants').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteVariant(id: string) {
  await requireCatalogManager();
  const { error } = await createInsumosSupabaseAdmin().from('product_variants').delete().eq('id', id);
  if (error) throw error;
}

export async function recordInventoryMovement(variantId: string, quantityDelta: number, movementType: InventoryMovementType, referenceType?: string | null, referenceId?: string | null, note?: string | null) {
  await requireCatalogManager();
  assertInventoryMovementConvention(movementType, quantityDelta);
  // record_inventory_movement is SECURITY DEFINER and re-checks has_role(admin/staff)
  // itself via auth.uid(). That check only sees the caller's identity when the
  // RPC runs through the session-aware client — the service-role admin client
  // carries no user JWT, so auth.uid() would be null and the function would
  // always reject the call with "Not authorized to update inventory".
  const supabase = await createInsumosSupabaseServer();
  const { data, error } = await supabase.rpc('record_inventory_movement', {
    p_variant_id: variantId, p_quantity_delta: quantityDelta, p_movement_type: movementType,
    p_reference_type: referenceType || null, p_reference_id: referenceId || null, p_note: note || null,
  });
  if (error) throw error;
  return data;
}
