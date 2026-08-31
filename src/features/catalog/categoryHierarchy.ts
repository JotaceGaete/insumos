import type { UUID } from './types';

export interface CategoryNode {
  id: UUID;
  parentId: UUID | null;
}

export function canAssignCategoryParent(categories: CategoryNode[], categoryId: UUID, parentId: UUID | null) {
  if (!parentId || parentId === categoryId) return parentId !== categoryId;
  const parents = new Map(categories.map((category) => [category.id, category.parentId]));
  const visited = new Set<UUID>();
  let current: UUID | null = parentId;

  while (current) {
    if (current === categoryId || visited.has(current)) return false;
    visited.add(current);
    current = parents.get(current) || null;
  }
  return true;
}
