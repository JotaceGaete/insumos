'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createInsumosSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_INSUMOS_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSUMOS_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Faltan las variables de Supabase de la tienda de insumos.');
  return createBrowserClient(url, anonKey);
}
