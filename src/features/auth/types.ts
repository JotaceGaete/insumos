import type { UUID } from '@/features/catalog/types';

export type AppRole = 'admin' | 'staff' | 'customer';

export interface Profile {
  id: UUID;
  displayName: string | null;
  phone: string | null;
  createdAt: string;
}

export interface UserRole {
  userId: UUID;
  role: AppRole;
}
