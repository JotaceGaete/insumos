import type { UUID } from '@/features/catalog/types';

export interface CartLine {
  productId: UUID;
  variantId: UUID;
  quantity: number;

  // --- Presentation snapshots only, captured when the line was added/updated.
  // The server remains the authority on price and stock once checkout exists;
  // nothing here should ever be trusted as the final price of an order. ---
  productName: string;
  variantName: string;
  slug: string;
  sku: string;
  imageUrl: string | null;
  unit: string | null;
  quantityValue: number | null;
  // Snapshot for display only. The server must calculate the final order price.
  unitPrice: number;
  // Known stock at the time this line was written, used only as a client-side
  // UX ceiling (disable +, clamp quantity). Not a reservation of any kind.
  stockAvailable: number | null;
}

export interface InsumosCart {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
}
