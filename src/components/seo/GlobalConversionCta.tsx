import Link from "next/link";
import { whatsappHref } from "@/lib/seo";

/** Franja de conversión visible en todas las páginas (sobre el footer). */
export default function GlobalConversionCta() {
  return (
    <div className="border-t border-indigo-100 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-center text-sm font-semibold sm:text-left sm:text-base">
          Cotiza tu timbre en minutos
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={whatsappHref("Hola, quiero cotizar un timbre de goma con Artesellos.")}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
          >
            WhatsApp
          </a>
          <Link
            href="/contacto"
            className="rounded-md border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Contacto
          </Link>
        </div>
      </div>
    </div>
  );
}
