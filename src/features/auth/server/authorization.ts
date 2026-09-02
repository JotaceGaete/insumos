import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole } from '../types';
import type { BuyerAccount } from '../types';
import { createInsumosSupabaseServer } from '@/features/shared/server/supabase';

export async function requireInsumosRole(allowedRoles: AppRole[]) {
  const supabase = await createInsumosSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('No autenticado.');

  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', allowedRoles);

  if (error || !roles?.length) throw new Error('No autorizado.');
  return user;
}

export const requireCatalogManager = () => requireInsumosRole(['admin', 'staff']);
export const requireCustomerManager = () => requireInsumosRole(['admin', 'staff']);

// Buyer identity is read here exclusively from customers.user_id — never
// from user_roles/has_role('customer'). Relies on the Etapa 6C RLS policy
// ("buyers read own customer row" using user_id = auth.uid()) to scope this
// select to at most the caller's own row; this function does not bypass RLS
// and does not create/link anything — linking only ever happens through
// claim_customer_for_current_user() (Etapa 6B), called from the auth pages.
async function loadBuyerAccount(supabase: SupabaseClient, userId: string): Promise<BuyerAccount | null> {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, email_normalized, full_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !customer) return null;
  return {
    userId,
    customerId: customer.id as string,
    email: customer.email_normalized as string,
    fullName: (customer.full_name as string | null) ?? null,
  };
}

/**
 * Guard for /mi-cuenta and future buyer-only routes. Throws when there is
 * no session, or when the session exists but customers.user_id has not
 * been linked yet — it never attempts to link (no UPDATE, no RPC call)
 * here, so this stays a pure read matching what Etapa 6C's RLS already
 * scopes. Linking is the auth pages' job (see resolveBuyerSessionForAuthPages).
 */
export async function requireBuyerAccount(): Promise<BuyerAccount> {
  const supabase = await createInsumosSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('No autenticado.');

  const account = await loadBuyerAccount(supabase, user.id);
  if (!account) throw new Error('Cuenta de comprador no vinculada.');
  return account;
}

export type BuyerSessionStatus =
  | { status: 'anonymous' }
  | { status: 'linked'; account: BuyerAccount }
  | { status: 'unlinked' };

/**
 * Used only by /iniciar-sesion and /crear-cuenta to decide what to show an
 * already-authenticated visitor. If a session exists but isn't linked yet,
 * this calls claim_customer_for_current_user() exactly once — the same
 * approved RPC from Etapa 6B, never a direct UPDATE — then re-checks. No
 * retry loop: a still-unlinked result after one attempt is surfaced as-is
 * for the caller to render, not retried again.
 */
export async function resolveBuyerSessionForAuthPages(): Promise<BuyerSessionStatus> {
  const supabase = await createInsumosSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'anonymous' };

  const existing = await loadBuyerAccount(supabase, user.id);
  if (existing) return { status: 'linked', account: existing };

  const { error: claimError } = await supabase.rpc('claim_customer_for_current_user');
  if (!claimError) {
    const linked = await loadBuyerAccount(supabase, user.id);
    if (linked) return { status: 'linked', account: linked };
  }
  return { status: 'unlinked' };
}
