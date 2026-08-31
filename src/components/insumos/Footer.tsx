import Link from 'next/link';

export default function InsumosFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center md:text-left">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              INSUMOS
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Materias primas para velas, jabones, perfumería, cosmética y packaging.
            </p>
          </div>

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
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-6 text-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} INSUMOS. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
