import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { SITE_URL } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  style: ["italic", "normal"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "ARTEMA",
  title: {
    default: "ARTEMA | Materias primas para crear",
    template: "%s | ARTEMA",
  },
  description:
    "Insumos y materias primas para velas, jabones, perfumería, cosmética y packaging.",
  keywords: [
    "insumos para velas",
    "insumos para jabones",
    "materias primas",
    "packaging",
  ],
  authors: [{ name: "ARTEMA" }],
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon-artema.svg",
    shortcut: "/favicon-artema.svg",
  },
  openGraph: {
    title: "ARTEMA | Materias primas para crear",
    description:
      "Insumos y materias primas para velas, jabones, perfumería, cosmética y packaging.",
    type: "website",
    url: SITE_URL,
    siteName: "ARTEMA",
    locale: "es_CL",
  },
  twitter: {
    card: "summary_large_image",
    title: "ARTEMA | Materias primas para crear",
    description:
      "Insumos y materias primas para velas, jabones, perfumería, cosmética y packaging.",
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
        className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-gray-50`}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
