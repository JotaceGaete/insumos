import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Contacto Artesellos: cotizaciones, consultas y soporte para timbres de goma en Chile.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/contacto" },
};

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
