import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Artesellos - Timbres Personalizados",
  description: "Tienda online de timbres personalizados para todas tus ocasiones especiales. Diseños únicos y de calidad para regalos, invitaciones y celebraciones.",
  keywords: "timbres personalizados, sellos personalizados, regalos personalizados, artesellos",
  authors: [{ name: "Artesellos" }],
  icons: {
    icon: "/favicon.svg", // Favicon personalizado de Artesellos
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Artesellos - Timbres Personalizados",
    description: "Tienda online de timbres personalizados para todas tus ocasiones especiales.",
    type: "website",
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
