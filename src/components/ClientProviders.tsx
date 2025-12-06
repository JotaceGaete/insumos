'use client';

import { CartProvider } from '@/lib/cartContext';
import { FavoritesProvider } from '@/lib/favoritesContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TopBanner from '@/components/TopBanner';
import ChatInterface from '@/components/ChatInterface';
import { WholesaleLevelBanner } from '@/components/wholesale/WholesalePrice';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <FavoritesProvider>
        <div className="min-h-screen flex flex-col">
          <TopBanner />
          <Navbar />
          <WholesaleLevelBanner />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          
          {/* Chatbot flotante disponible en todas las páginas */}
          <ChatInterface />
        </div>
      </FavoritesProvider>
    </CartProvider>
  );
}

