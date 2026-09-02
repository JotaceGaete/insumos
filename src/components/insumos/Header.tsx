'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Leaf, Menu, X, Search, User, ShoppingBag, Truck, HelpCircle, Phone } from 'lucide-react'
import { useInsumosCart } from '@/features/cart/CartProvider'
import { createInsumosSupabaseBrowser } from '@/features/shared/client/supabase'

const navLinks = [
  { href: '/', label: 'Inicio' },
  { href: '/productos', label: 'Productos' },
  { href: '/#categorias', label: 'Categorías' },
]

const comingSoonLinks = ['Novedades', 'Ofertas']

export default function InsumosHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const pathname = usePathname()
  const router = useRouter()
  const { itemCount, openDrawer } = useInsumosCart()
  // Session presence only — enough to switch between "Iniciar sesión" /
  // "Crear cuenta" and "Mi cuenta". Whether the session already resolved a
  // linked customer is a /mi-cuenta (server-side, RLS-scoped) concern, not
  // the header's — it never queries customers itself.
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    const supabase = createInsumosSupabaseBrowser()
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session))
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const isActiveLink = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href.startsWith('/#')) return false
    return pathname.startsWith(href)
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const query = searchValue.trim()
    router.push(query ? `/productos?q=${encodeURIComponent(query)}` : '/productos')
    setIsMenuOpen(false)
  }

  return (
    <>
      {/* Barra superior */}
      <div className="bg-insumos-forest text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-xs sm:px-6 lg:px-8">
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <Truck className="h-3.5 w-3.5" aria-hidden />
            Envíos a todo Chile · Despachos rápidos y seguros
          </span>
          <span className="inline-flex items-center gap-1.5 sm:hidden">
            <Truck className="h-3.5 w-3.5" aria-hidden />
            Envíos a todo Chile
          </span>
          <div className="flex items-center gap-4 text-white/85">
            <span className="inline-flex items-center gap-1.5" title="Próximamente">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
              Ayuda
            </span>
            <span className="hidden items-center gap-1.5 sm:inline-flex" title="Próximamente">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              Contacto
            </span>
          </div>
        </div>
      </div>

      {/* Header principal */}
      <header className="sticky top-0 z-50 border-b border-insumos-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex flex-shrink-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-insumos-forest">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-insumos-mint text-insumos-forest transition-transform group-hover:scale-105">
              <Leaf className="h-5 w-5" aria-hidden />
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-lg font-extrabold tracking-tight text-insumos-forest">ARTEMA</span>
              <span className="mt-1 text-[11px] text-stone-500">Materias primas para crear</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  isActiveLink(link.href)
                    ? 'bg-insumos-mint text-insumos-forest'
                    : 'text-stone-600 hover:bg-insumos-cream hover:text-insumos-forest'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {comingSoonLinks.map((label) => (
              <span
                key={label}
                title="Próximamente"
                className="cursor-default select-none rounded-full px-4 py-2 text-sm font-semibold text-stone-400"
              >
                {label}
              </span>
            ))}
          </nav>

          <form onSubmit={submitSearch} role="search" className="hidden flex-1 max-w-xs items-center gap-2 rounded-full border border-insumos-line bg-insumos-cream px-4 py-2 lg:flex">
            <Search className="h-4 w-4 flex-shrink-0 text-insumos-sage" aria-hidden />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Buscar insumos..."
              aria-label="Buscar insumos"
              className="w-full bg-transparent text-sm text-insumos-ink placeholder:text-stone-400 outline-none"
            />
          </form>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Link
              href={hasSession ? '/mi-cuenta' : '/iniciar-sesion'}
              title={hasSession ? 'Mi cuenta' : 'Iniciar sesión'}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-insumos-line text-stone-600 transition-colors hover:bg-insumos-cream hover:text-insumos-forest sm:inline-flex"
            >
              <User className="h-5 w-5" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={openDrawer}
              aria-label={itemCount > 0 ? `Carrito, ${itemCount} producto${itemCount === 1 ? '' : 's'}` : 'Carrito'}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-insumos-forest text-white transition-transform hover:scale-105"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-insumos-sage px-1 text-[11px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsMenuOpen((value) => !value)}
              className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-stone-600 hover:bg-insumos-cream lg:hidden"
              aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="border-t border-insumos-line bg-white px-4 py-4 lg:hidden">
            <form onSubmit={submitSearch} role="search" className="flex items-center gap-2 rounded-full border border-insumos-line bg-insumos-cream px-4 py-2.5">
              <Search className="h-4 w-4 flex-shrink-0 text-insumos-sage" aria-hidden />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar insumos..."
                aria-label="Buscar insumos"
                className="w-full bg-transparent text-sm text-insumos-ink placeholder:text-stone-400 outline-none"
              />
            </form>
            <div className="mt-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${
                    isActiveLink(link.href) ? 'bg-insumos-mint text-insumos-forest' : 'text-stone-700 hover:bg-insumos-cream'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {comingSoonLinks.map((label) => (
                <span key={label} title="Próximamente" className="block cursor-default select-none rounded-lg px-3 py-2.5 text-sm font-semibold text-stone-400">
                  {label}
                </span>
              ))}
              <div className="my-2 border-t border-insumos-line" />
              {hasSession ? (
                <Link
                  href="/mi-cuenta"
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-insumos-cream"
                >
                  Mi cuenta
                </Link>
              ) : (
                <>
                  <Link
                    href="/iniciar-sesion"
                    onClick={() => setIsMenuOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-insumos-cream"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/crear-cuenta"
                    onClick={() => setIsMenuOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-insumos-cream"
                  >
                    Crear cuenta
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  )
}
