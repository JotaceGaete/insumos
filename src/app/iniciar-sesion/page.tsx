import { redirect } from 'next/navigation';
import { resolveBuyerSessionForAuthPages } from '@/features/auth/server/authorization';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { SignOutButton } from '@/features/auth/components/SignOutButton';

export default async function IniciarSesionPage() {
  const session = await resolveBuyerSessionForAuthPages();

  if (session.status === 'linked') {
    redirect('/mi-cuenta');
  }

  if (session.status === 'unlinked') {
    // Session is real, but claim_customer_for_current_user() was already
    // attempted once (inside resolveBuyerSessionForAuthPages) and still
    // didn't resolve a customer — showing the login form again would be
    // confusing for someone already authenticated, and retrying the claim
    // automatically here would risk a redirect loop with /mi-cuenta's own
    // guard. Surface it plainly instead.
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-bold text-stone-900">No pudimos vincular tu cuenta</h1>
        <p className="text-sm text-stone-600">
          Tu sesión está activa, pero no pudimos asociarla a una cuenta comercial todavía. Intenta cerrar sesión y volver a iniciarla, o contáctanos si el problema continúa.
        </p>
        <SignOutButton />
      </main>
    );
  }

  return <LoginForm />;
}
