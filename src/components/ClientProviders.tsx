'use client';

import { usePathname } from 'next/navigation';
import { CartProvider } from '@/lib/cartContext';
import { FavoritesProvider } from '@/lib/favoritesContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TopBanner from '@/components/TopBanner';
import ChatInterface from '@/components/ChatInterface';
import FloatingWhatsApp from '@/components/seo/FloatingWhatsApp';
import GlobalConversionCta from '@/components/seo/GlobalConversionCta';
import InsumosHeader from '@/components/insumos/Header';
import InsumosFooter from '@/components/insumos/Footer';
import { isInsumosRoute } from '@/lib/insumosRoutes';
import { InsumosCartProvider } from '@/features/cart/CartProvider';
import { CartDrawer } from '@/features/cart/CartDrawer';

// The admin panel (AdminShell) and its login gate (AdminLogin) render their
// own complete page chrome. They must never inherit the customer-facing
// Artesellos navbar/topbar/chatbot/WhatsApp or the INSUMOS storefront shell —
// admin gets bare children, full stop.
function isAdminRoute(pathname: string) {
  return pathname.startsWith('/admin') || pathname.startsWith('/acceso-admin');
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = isAdminRoute(pathname ?? '');
  const insumos = !admin && isInsumosRoute(pathname ?? '');

  const shell = admin ? (
    <>{children}</>
  ) : (
    <div className="min-h-screen flex flex-col">
      {insumos ? (
        <InsumosHeader />
      ) : (
        <>
          <TopBanner />
          <Navbar />
        </>
      )}
      <main className="flex-1">
        {children}
      </main>
      {insumos ? (
        <InsumosFooter />
      ) : (
        <>
          <GlobalConversionCta />
          <Footer />
          <FloatingWhatsApp />
          {/* Chatbot flotante disponible en las páginas legacy */}
          <ChatInterface />
        </>
      )}
    </div>
  );

  return (
    <CartProvider>
      <FavoritesProvider>
        {insumos ? (
          // Cart lives only on the INSUMOS side of the tree — legacy Artesellos
          // keeps its own CartProvider above, untouched.
          <InsumosCartProvider>
            {shell}
            <CartDrawer />
          </InsumosCartProvider>
        ) : shell}
      </FavoritesProvider>
    </CartProvider>
  );
}

