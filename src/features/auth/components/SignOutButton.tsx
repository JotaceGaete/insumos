'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createInsumosSupabaseBrowser } from '@/features/shared/client/supabase';

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await createInsumosSupabaseBrowser().auth.signOut();
    router.replace('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={className ?? 'rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50'}
    >
      {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
    </button>
  );
}
