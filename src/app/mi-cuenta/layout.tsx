import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireBuyerAccount } from '@/features/auth/server/authorization';

export default async function MiCuentaLayout({ children }: { children: ReactNode }) {
  try {
    await requireBuyerAccount();
  } catch {
    redirect('/iniciar-sesion');
  }
  return <>{children}</>;
}
