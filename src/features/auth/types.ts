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
  /** Raw customers.full_name — the authoritative commercial value. Never
   * guessed, never backfilled from auth metadata. Null until a checkout or
   * (future) explicit profile edit sets it. */
  fullName: string | null;
  phoneNormalized: string | null;
  /** fullName if set, otherwise a READ-ONLY fallback read from this
   * session's own Supabase Auth signup metadata (raw_user_meta_data.full_name)
   * — for display only. Never written back to customers.full_name, so it
   * can never overwrite a valid commercial value (Etapa 6D/6E full_name
   * debt: see authorization.ts resolveMetadataDisplayName). */
  displayName: string | null;
}
