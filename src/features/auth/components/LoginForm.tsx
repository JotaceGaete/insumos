'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createInsumosSupabaseBrowser } from '@/features/shared/client/supabase';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createInsumosSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;

      // claim_customer_for_current_user() is the only place identity gets
      // linked — it reads auth.uid()/auth.users itself, so nothing here
      // passes an email or customer id. See Etapa 6B for the RPC's own
      // validation/idempotency guarantees.
      const { error: claimError } = await supabase.rpc('claim_customer_for_current_user');
      if (claimError) {
        setError('Iniciaste sesión, pero no pudimos vincular tu cuenta comercial. Intenta nuevamente o contáctanos.');
        setSubmitting(false);
        return;
      }

      router.replace('/mi-cuenta');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible iniciar sesión.');
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <form onSubmit={submit} className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-insumos-forest">Mi cuenta</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-900">Inicia sesión</h1>
        <label className="mt-6 block text-sm font-medium text-stone-700">Correo
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-stone-700">Contraseña
          <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" />
        </label>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <button disabled={submitting} className="mt-6 w-full rounded-md bg-insumos-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>
        <p className="mt-4 text-center text-sm text-stone-600">
          ¿No tienes cuenta? <Link href="/crear-cuenta" className="font-semibold text-insumos-forest hover:underline">Crea una</Link>
        </p>
      </form>
    </main>
  );
}
