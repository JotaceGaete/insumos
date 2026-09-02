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

// Buyer commercial identity — deliberately unrelated to Profile/UserRole
// above. Resolved exclusively from customers.user_id = auth.uid(), never
// from user_roles/has_role('customer').
export interface BuyerAccount {
  userId: UUID;
  customerId: UUID;
  email: string;
  fullName: string | null;
}
