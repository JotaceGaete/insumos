import { redirect } from 'next/navigation';
import { resolveBuyerSessionForAuthPages } from '@/features/auth/server/authorization';
import { SignupForm } from '@/features/auth/components/SignupForm';
import { SignOutButton } from '@/features/auth/components/SignOutButton';

export default async function CrearCuentaPage() {
  const session = await resolveBuyerSessionForAuthPages();

  if (session.status === 'linked') {
    redirect('/mi-cuenta');
  }

  if (session.status === 'unlinked') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-bold text-stone-900">No pudimos vincular tu cuenta</h1>
        <p className="text-sm text-stone-600">
          Ya tienes una sesión activa, pero no pudimos asociarla a una cuenta comercial todavía. Intenta cerrar sesión y volver a iniciarla, o contáctanos si el problema continúa.
        </p>
        <SignOutButton />
      </main>
    );
  }

  return <SignupForm />;
}
