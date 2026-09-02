import { requireBuyerAccount } from '@/features/auth/server/authorization';
import { SignOutButton } from '@/features/auth/components/SignOutButton';

// Minimal MVP — Etapa 6D closes the auth flow only. KPIs, order history,
// order detail and profile editing all belong to 6E/6F.
export default async function MiCuentaPage() {
  const account = await requireBuyerAccount();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900">Tu cuenta está activa</h1>
      <dl className="mt-4 space-y-1 text-sm text-stone-600">
        <div>
          <dt className="inline text-stone-400">Nombre: </dt>
          <dd className="inline">{account.fullName || '—'}</dd>
        </div>
        <div>
          <dt className="inline text-stone-400">Email: </dt>
          <dd className="inline">{account.email}</dd>
        </div>
      </dl>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </main>
  );
}
