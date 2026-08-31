import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireCatalogManager } from '@/features/auth/server/authorization';
import { AdminShell } from '@/features/admin/components/AdminShell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireCatalogManager();
  } catch {
    redirect('/acceso-admin');
  }
  return <AdminShell>{children}</AdminShell>;
}


