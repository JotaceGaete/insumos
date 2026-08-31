import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { SITE_URL } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "INSUMOS | Materias primas para crear",
    template: "%s | INSUMOS",
  },
  description:
    "Insumos y materias primas para velas, jabones, perfumería, cosmética y packaging.",
  keywords: [
    "insumos para velas",
    "insumos para jabones",
    "materias primas",
    "packaging",
  ],
  authors: [{ name: "INSUMOS" }],
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon-insumos.svg",
    shortcut: "/favicon-insumos.svg",
  },
  openGraph: {
    title: "INSUMOS | Materias primas para crear",
    description:
      "Insumos y materias primas para velas, jabones, perfumería, cosmética y packaging.",
    type: "website",
    url: SITE_URL,
    locale: "es_CL",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} font-sans antialiased bg-gray-50`}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
