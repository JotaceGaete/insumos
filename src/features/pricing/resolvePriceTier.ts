import type { PriceTier } from '@/features/catalog/types';

export function resolvePriceTier(tiers: PriceTier[], quantity: number): PriceTier | null {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('La cantidad debe ser un entero positivo.');
  const matches = tiers.filter((tier) => quantity >= tier.minimumQuantity && (tier.maximumQuantity === null || quantity <= tier.maximumQuantity));
  if (matches.length > 1) throw new Error('Los tramos de precio se superponen.');
  return matches[0] || null;
}
