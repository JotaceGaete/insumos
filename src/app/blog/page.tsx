import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog | Guías sobre timbres y sellos en Chile",
  description:
    "Artículos sobre timbres de goma, costos en Chile, tipos de sellos y buenas prácticas para empresas y emprendedores.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/blog" },
};

const posts = [
  {
    href: "/blog/como-hacer-un-timbre-de-empresa",
    title: "Cómo hacer un timbre de empresa paso a paso",
    excerpt:
      "Requisitos de diseño, datos que incluir y cómo preparar archivos para un timbre corporativo profesional.",
  },
  {
    href: "/blog/cuanto-cuesta-un-timbre-en-chile",
    title: "Cuánto cuesta un timbre en Chile: guía de referencia",
    excerpt:
      "Factores que influyen en el precio, formatos y consejos para cotizar sin sorpresas.",
  },
  {
    href: "/blog/tipos-de-timbres",
    title: "Tipos de timbres: manual, automático y más",
    excerpt:
      "Comparación práctica para elegir entre sellos de goma, montajes y usos recomendados.",
  },
];

export default function BlogIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Blog ARTEMA
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Guías prácticas sobre timbres de goma, costos y tipos de sellos para negocios en Chile.
      </p>
      <ul className="mt-10 space-y-6">
        {posts.map((post) => (
          <li key={post.href}>
            <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-indigo-200">
              <h2 className="text-xl font-semibold text-gray-900">
                <Link href={post.href} className="hover:text-indigo-600">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-gray-600">{post.excerpt}</p>
              <Link
                href={post.href}
                className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Leer artículo →
              </Link>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
