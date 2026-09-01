'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

// Root error boundary: catches anything an uncaught server-side throw (a
// raw Postgrest/Supabase error, or otherwise) would previously dump straight
// into the browser as Next's raw dev error overlay. Renders a normal page
// instead — the actual error still reaches the server console via the log
// below, it just never reaches the visitor as a crashed screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled route error', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-insumos-cream">
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-insumos-mint text-insumos-forest">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-insumos-ink sm:text-3xl">Algo salió mal</h1>
        <p className="mt-2 text-sm text-stone-600 sm:text-base">
          No pudimos cargar esta página. Intenta nuevamente en unos segundos.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-full bg-insumos-forest px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-insumos-forest-dark"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-insumos-line px-6 py-3 text-sm font-semibold text-insumos-ink transition-colors hover:bg-white"
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    </div>
  );
}
