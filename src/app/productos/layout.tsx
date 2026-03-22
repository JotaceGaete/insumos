import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Productos",
  description:
    "Catálogo de timbres y sellos personalizados. Compra en línea con despacho en Chile.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/productos" },
};

export default function ProductosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
