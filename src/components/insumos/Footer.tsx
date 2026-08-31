import Link from 'next/link';
import { Leaf } from 'lucide-react';

export default function InsumosFooter() {
  return (
    <footer className="border-t border-insumos-line bg-insumos-forest text-white/70">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 text-center md:grid-cols-2 md:text-left">
          <div>
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white">
                <Leaf className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-xl font-extrabold tracking-tight text-white">ArteInsumos</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Materias primas para velas, jabones, perfumería, cosmética y packaging.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">Enlaces</h3>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm md:justify-start">
              <Link href="/" className="transition-colors hover:text-white">
                Inicio
              </Link>
              <span className="text-white/30">•</span>
              <Link href="/productos" className="transition-colors hover:text-white">
                Productos
              </Link>
              <span className="text-white/30">•</span>
              <Link href="/#categorias" className="transition-colors hover:text-white">
                Categorías
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 text-center">
          <p className="text-sm text-white/50">© {new Date().getFullYear()} ArteInsumos. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
