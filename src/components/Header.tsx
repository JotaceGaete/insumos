'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <div className="text-2xl font-bold text-indigo-600">
                ARTEMA
              </div>
              <span className="ml-2 text-sm text-gray-500 hidden sm:block">
                Timbres Personalizados
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link
              href="/"
              className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Inicio
            </Link>
            <Link
              href="/productos"
              className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Productos
            </Link>
            <div className="relative group">
              <button className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-colors flex items-center">
                Servicios
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <Link
                  href="/cotizaciones"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Cotizaciones
                </Link>
                <Link
                  href="/registro-comercios"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Registro Mayorista
                </Link>
                <Link
                  href="/seguimiento"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Seguimiento
                </Link>
              </div>
            </div>
            <Link
              href="/sobre-nosotros"
              className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Sobre Nosotros
            </Link>
            <Link
              href="/contacto"
              className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-colors"
            >
              Contacto
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-700 hover:text-indigo-600 hover:bg-gray-100 transition-colors"
            aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 animate-in slide-in-from-top duration-300">
            <nav className="flex flex-col space-y-2">
              <Link
                href="/"
                className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Inicio
              </Link>
              <Link
                href="/productos"
                className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Productos
              </Link>
              
              <div className="border-t border-gray-100 my-2"></div>
              
              <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Servicios
              </div>
              <Link
                href="/cotizaciones"
                className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-6 py-2 text-sm font-medium rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Cotizaciones
              </Link>
              <Link
                href="/registro-comercios"
                className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-6 py-2 text-sm font-medium rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Registro Mayorista
              </Link>
              <Link
                href="/seguimiento"
                className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-6 py-2 text-sm font-medium rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Seguimiento
              </Link>
              
              <div className="border-t border-gray-100 my-2"></div>
              
              <Link
                href="/sobre-nosotros"
                className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Sobre Nosotros
              </Link>
              <Link
                href="/contacto"
                className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Contacto
              </Link>
              <Link
                href="/terminos"
                className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Términos y Condiciones
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
