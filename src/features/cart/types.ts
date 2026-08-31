import type { UUID } from '@/features/catalog/types';

export interface CartLine {
  productId: UUID;
  variantId: UUID;
  productName: string;
  variantName: string;
  sku: string;
  // Snapshot for display only. The server must calculate the final order price.
  unitPrice: number;
  quantity: number;
}

export interface InsumosCart {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
}
