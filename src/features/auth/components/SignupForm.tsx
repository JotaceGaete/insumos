'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createInsumosSupabaseBrowser } from '@/features/shared/client/supabase';

export function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createInsumosSupabaseBrowser();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        // Not the expected path (this project requires email confirmation —
        // confirmed empirically in Etapa 6B), but handled for completeness
        // in case that setting ever changes: a session means we can link
        // right away instead of waiting on /auth/callback.
        await supabase.rpc('claim_customer_for_current_user');
        window.location.href = '/mi-cuenta';
        return;
      }

      setConfirmationSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear tu cuenta.');
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmationSent) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-stone-900">Revisa tu correo</h1>
          <p className="mt-2 text-sm text-stone-600">
            Te enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo para activar tu cuenta.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <form onSubmit={submit} className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-insumos-forest">Crear cuenta</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-900">Únete a ARTEMA</h1>
        <label className="mt-6 block text-sm font-medium text-stone-700">Nombre
          <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-stone-700">Correo
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-stone-700">Contraseña
          <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm font-medium text-stone-700">Confirmar contraseña
          <input required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2" />
        </label>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <button disabled={submitting} className="mt-6 w-full rounded-md bg-insumos-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
        <p className="mt-4 text-center text-sm text-stone-600">
          ¿Ya tienes cuenta? <Link href="/iniciar-sesion" className="font-semibold text-insumos-forest hover:underline">Inicia sesión</Link>
        </p>
      </form>
    </main>
  );
}
