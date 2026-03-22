import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diseño personalizado",
  description:
    "Sube tu arte y cotiza timbres de goma personalizados. Asesoría y producción en Chile.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/diseno-personalizado" },
};

export default function DisenoPersonalizadoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
