import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Productos",
  description:
    "Catálogo de insumos y materias primas para velas, jabones, perfumería, cosmética y packaging.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/productos" },
};

export default function ProductosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
