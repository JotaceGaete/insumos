import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getPublicConfig() {
  const url = process.env.NEXT_PUBLIC_INSUMOS_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSUMOS_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Faltan las variables de Supabase de la tienda de insumos.');
  }
  return { url, anonKey };
}

export async function createInsumosSupabaseServer() {
  const { url, anonKey } = getPublicConfig();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot mutate cookies; middleware may refresh the session.
        }
      },
    },
  });
}

export function createInsumosSupabaseAdmin() {
  const { url } = getPublicConfig();
  const serviceRoleKey = process.env.INSUMOS_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('Falta INSUMOS_SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
