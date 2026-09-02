'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/productos', label: 'Productos' },
  { href: '/admin/productos/nuevo', label: 'Nuevo producto' },
  { href: '/admin/categorias', label: 'Categorías' },
  { href: '/admin/clientes', label: 'Clientes' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="w-full shrink-0 border-b border-stone-200 bg-white pb-4 md:w-56 md:border-b-0 md:border-r md:pb-0 md:pr-4">
          <nav className="flex flex-col gap-1 pt-4 md:pt-0">
            {links.map((link) => {
              const isActive = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-amber-50 text-amber-800' : 'text-stone-700 hover:bg-amber-50 hover:text-amber-800'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
