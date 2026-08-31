import 'server-only';
import type { AppRole } from '../types';
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
