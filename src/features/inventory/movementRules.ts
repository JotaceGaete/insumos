import type { InventoryMovementType } from '@/features/catalog/types';

const POSITIVE_MOVEMENTS: InventoryMovementType[] = ['initial', 'purchase', 'return', 'release'];
const NEGATIVE_MOVEMENTS: InventoryMovementType[] = ['sale', 'reservation'];

export function assertInventoryMovementConvention(type: InventoryMovementType, quantityDelta: number) {
  if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
    throw new Error('El movimiento debe tener una cantidad entera distinta de cero.');
  }
  if (POSITIVE_MOVEMENTS.includes(type) && quantityDelta < 0) {
    throw new Error(`${type} debe aumentar el stock.`);
  }
  if (NEGATIVE_MOVEMENTS.includes(type) && quantityDelta > 0) {
    throw new Error(`${type} debe disminuir el stock.`);
  }
}
