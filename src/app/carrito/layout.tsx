import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carrito",
  description: "Revisa los insumos que agregaste a tu carrito antes de continuar.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/carrito" },
};

export default function CarritoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
