import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Grid principal - 3 columnas en desktop, 1 en móvil */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          
          {/* COLUMNA 1: Marca + Eslogan */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Artesellos
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Timbres personalizados profesionales
            </p>
          </div>

          {/* COLUMNA 2: Enlaces + Contacto */}
          <div className="space-y-4">
            {/* Enlaces de navegación */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
                Enlaces
              </h3>
              <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-2 text-sm">
                <Link href="/" className="hover:text-white transition-colors">
                  Inicio
                </Link>
                <span className="text-gray-700">•</span>
                <Link href="/productos" className="hover:text-white transition-colors">
                  Productos
                </Link>
                <span className="text-gray-700">•</span>
                <Link href="/contacto" className="hover:text-white transition-colors">
                  Contacto
                </Link>
                <span className="text-gray-700">•</span>
                <Link href="/blog" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </div>
              <h3 className="text-sm font-semibold text-white mt-6 mb-2 uppercase tracking-wider">
                Timbres y sellos
              </h3>
              <div className="flex flex-wrap justify-center md:justify-start gap-x-3 gap-y-2 text-xs text-gray-400">
                <Link href="/timbres-personalizados" className="hover:text-white transition-colors">
                  Timbres personalizados
                </Link>
                <span className="text-gray-700">•</span>
                <Link href="/timbres-empresa" className="hover:text-white transition-colors">
                  Timbres empresa
                </Link>
                <span className="text-gray-700">•</span>
                <Link href="/timbre-rut" className="hover:text-white transition-colors">
                  Timbre RUT
                </Link>
                <span className="text-gray-700">•</span>
                <Link href="/timbres-automaticos" className="hover:text-white transition-colors">
                  Timbres automáticos
                </Link>
                <span className="text-gray-700">•</span>
                <Link href="/sellos-para-negocios" className="hover:text-white transition-colors">
                  Sellos para negocios
                </Link>
              </div>
            </div>

            {/* Información de contacto */}
            <div className="space-y-2 text-sm">
              <div>
                <a
                  href="mailto:contacto@artesellos.cl"
                  className="hover:text-white transition-colors inline-flex items-center gap-2"
                >
                  <span>✉️</span>
                  <span>contacto@artesellos.cl</span>
                </a>
              </div>
              <div>
                <a
                  href="tel:+56922384216"
                  className="hover:text-white transition-colors inline-flex items-center gap-2"
                >
                  <span>📞</span>
                  <span>+56 9 22384216</span>
                </a>
              </div>
              <div className="inline-flex items-center gap-2">
                <span>📍</span>
                <span>Bannen 83 L 4, Coronel</span>
              </div>
            </div>
          </div>

          {/* COLUMNA 3: Instagram */}
          <div className="flex flex-col items-center md:items-end justify-center">
            <p className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
              Síguenos
            </p>
            <a
              href="https://instagram.com/artesellos"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-sm hover:text-white transition-colors"
              aria-label="Instagram de Artesellos"
            >
              {/* Icono de Instagram */}
              <svg
                className="w-8 h-8 text-gray-400 group-hover:text-pink-500 transition-colors"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span className="hidden sm:inline">@artesellos</span>
            </a>
          </div>
        </div>

        {/* Separador y Copyright */}
        <div className="border-t border-gray-800 mt-8 pt-6 text-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Artesellos. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Construido por Artesellos para Artesellos
          </p>
        </div>
      </div>
    </footer>
  );
}
