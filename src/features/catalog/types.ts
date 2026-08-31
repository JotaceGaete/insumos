export type UUID = string;

export type ProductStatus = 'active' | 'draft' | 'archived';
export type PriceAudience = 'retail' | 'wholesale';
export type DocumentKind = 'technical_sheet' | 'safety_sheet' | 'certificate' | 'other';

export interface CatalogCategory {
  id: UUID;
  parentId: UUID | null;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogProduct {
  id: UUID;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  status: ProductStatus;
  isFeatured: boolean;
  categoryId: UUID | null;
  brand: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ProductVariant {
  id: UUID;
  productId: UUID;
  sku: string;
  name: string;
  optionValue: string | null;
  attributes: Record<string, string>;
  unit: string | null;
  quantityValue: number | null;
  retailPrice: number;
  wholesalePrice: number | null;
  costPrice: number | null;
  // Physical stock on hand — the admin/inventory source of truth. Public
  // storefront display and purchase limits should use availableStock
  // instead (stockQuantity minus other buyers' active, unexpired holds).
  stockQuantity: number;
  availableStock: number;
  lowStockThreshold: number;
  weightGrams: number | null;
  minQuantity: number;
  maxQuantity: number | null;
  isActive: boolean;
}

export interface ProductMedia {
  id: UUID;
  productId: UUID;
  variantId: UUID | null;
  storagePath: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductDocument {
  id: UUID;
  productId: UUID;
  kind: DocumentKind;
  title: string;
  storagePath: string;
  isPublic: boolean;
}

export interface PriceTier {
  id: UUID;
  variantId: UUID;
  audience: PriceAudience;
  minimumQuantity: number;
  maximumQuantity: number | null;
  unitPrice: number;
  currency: 'CLP';
}

export type InventoryMovementType =
  | 'initial'
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'return'
  | 'reservation'
  | 'release';

export interface InventoryMovement {
  id: UUID;
  variantId: UUID;
  movementType: InventoryMovementType;
  quantityDelta: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: UUID | null;
  note: string | null;
  createdAt: string;
}
