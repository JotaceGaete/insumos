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

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const insumos = isInsumosRoute(pathname ?? '');

  return (
    <CartProvider>
      <FavoritesProvider>
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
      </FavoritesProvider>
    </CartProvider>
  );
}

