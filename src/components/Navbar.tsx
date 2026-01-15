'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const isActiveLink = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  const navLinks = [
    { href: '/', label: 'Inicio' },
    { href: '/productos', label: 'Productos' },
    { href: '/diseno-personalizado', label: 'Diseño Personalizado' },
    { href: '/contacto', label: 'Contacto' }
  ]

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">

            {/* IZQUIERDA: LOGO + MARCA */}
            <div className="flex-shrink-0">
              <Link
                href="/"
                className="group flex items-center gap-2.5 rounded-xl p-1 outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {/* Logo */}
                <div className="relative w-11 h-11 flex-shrink-0 rounded-xl bg-indigo-50 ring-1 ring-indigo-100 shadow-sm grid place-items-center transition-transform duration-200 group-hover:scale-[1.05]">
                  <Image
                    src="/logo.svg"
                    alt="Artesellos Logo"
                    width={28}
                    height={28}
                    className="object-contain drop-shadow-sm"
                    priority
                  />
                </div>

                {/* Texto marca */}
                <div className="hidden sm:flex flex-col">
                  <span className="text-[18px] font-extrabold text-gray-900 tracking-[-0.02em] leading-none">
                    Artesellos
                  </span>
                  <span className="mt-1 text-[11px] text-gray-500 tracking-wide leading-none">
                    Timbres personalizados
                  </span>
                </div>
              </Link>
            </div>

            {/* CENTRO: NAVEGACIÓN */}
            <div className="hidden lg:flex items-center justify-center flex-1 px-8">
              <div className="flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-5 py-2.5 text-[13px] font-semibold tracking-wide relative transition-all duration-200 rounded-lg ${
                      isActiveLink(link.href)
                        ? 'text-indigo-600 bg-indigo-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {link.label}
                    {isActiveLink(link.href) && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full"></span>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {/* DERECHA: BOTÓN MOBILE */}
            <div className="flex items-center">
              <button
                onClick={toggleMenu}
                className="lg:hidden p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
                aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MENÚ MOBILE */}
      {isMenuOpen && (
        <div className="lg:hidden bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-lg animate-in fade-in slide-in-from-top-5 duration-300">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className={`block px-4 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    isActiveLink(link.href)
                      ? 'text-indigo-600 bg-indigo-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
