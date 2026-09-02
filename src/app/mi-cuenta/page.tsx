import { requireBuyerAccount } from '@/features/auth/server/authorization';
import { getMyCommercialSummary, listMyOrders } from '@/features/customers/server/buyerQueries';
import { AccountOverview } from '@/features/customers/components/AccountOverview';
import { SignOutButton } from '@/features/auth/components/SignOutButton';

// Read-only MVP: account data, KPIs (same semantics already approved in
// Etapa 3 — see buyerQueries.ts), and full order history. All three
// queries run through the session-aware server client, authorized
// entirely by the Etapa 6C RLS policies — never service_role. Order
// detail, profile editing and authenticated checkout are explicitly out
// of scope here (6F/6G).
export default async function MiCuentaPage() {
  const account = await requireBuyerAccount();
  const [summary, orders] = await Promise.all([
    getMyCommercialSummary(account.customerId),
    listMyOrders(account.customerId),
  ]);

  return (
    <div>
      <AccountOverview account={account} summary={summary} orders={orders} />
      <div className="mx-auto max-w-4xl px-4 pb-10">
        <SignOutButton />
      </div>
    </div>
  );
}
