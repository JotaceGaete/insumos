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
    default: "Timbres de goma personalizados en Chile | Artesellos",
    template: "%s | Artesellos",
  },
  description:
    "Fabricamos timbres de goma personalizados para empresas y emprendedores en Chile. Diseños rápidos, despacho y excelente calidad.",
  keywords: [
    "timbres de goma",
    "timbres personalizados",
    "timbre empresa",
    "timbre RUT Chile",
    "sellos Chile",
  ],
  authors: [{ name: "Artesellos" }],
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Timbres de goma personalizados en Chile | Artesellos",
    description:
      "Fabricamos timbres de goma personalizados para empresas y emprendedores en Chile.",
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
