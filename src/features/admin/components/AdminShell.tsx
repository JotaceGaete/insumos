import Link from 'next/link';

const links = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/productos', label: 'Productos' },
  { href: '/admin/productos/nuevo', label: 'Nuevo producto' },
  { href: '/admin/categorias', label: 'Categorías' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="w-full shrink-0 border-b border-stone-200 bg-white md:w-56 md:border-b-0 md:border-r">
          <nav className="flex gap-1 overflow-x-auto p-3 md:block md:space-y-1 md:p-4">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-amber-50 hover:text-amber-800">
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
