import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Completa tus datos de entrega para confirmar tu pedido.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/finalizar-compra" },
};

export default function FinalizarCompraLayout({ children }: { children: React.ReactNode }) {
  return children;
}
