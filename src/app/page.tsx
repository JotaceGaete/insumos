export const runtime = "edge";

import type { Metadata } from "next";
import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import ProductCarousel from "@/components/ProductCarousel";
import Carousel from "@/components/Carousel";
import Categorias from "@/components/Categorias";
import HomeSeoContent from "@/components/seo/HomeSeoContent";
import WhatsAppButton from "@/components/seo/WhatsAppButton";
// Slides ahora se obtienen desde Supabase directamente (Server Component)
import { carouselSlides } from '@/lib/carouselData';
import { supabaseServerUtils } from '@/lib/supabaseUtils';
import { adaptSupabaseProducts } from "@/lib/productAdapter";

export const metadata: Metadata = {
  title: "Timbres de goma personalizados en Chile",
  description:
    "Fabricamos timbres de goma personalizados para empresas y emprendedores en Chile. Diseños rápidos, despacho y excelente calidad.",
  keywords: [
    "timbres de goma",
    "timbres personalizados",
    "timbre empresa",
    "timbre RUT Chile",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Timbres de goma personalizados en Chile | Artesellos",
    description:
      "Fabricamos timbres de goma personalizados para empresas y emprendedores en Chile. Diseños rápidos, despacho y excelente calidad.",
  },
};

// Obtener y adaptar productos desde Supabase (server) usando utilidades tipadas
async function getMyRealProducts() {
  const supa = await supabaseServerUtils.getProducts();
  return adaptSupabaseProducts(supa);
}

async function getSlides() {
  try {
    const data = await supabaseServerUtils.getSlides();
    
    const apiSlides = (data || []).map((s: any, i: number) => ({
      id: i + 1,
      title: s.title,
      subtitle: s.subtitle,
      description: s.description,
      buttonText: s.button_text,
      buttonLink: s.button_link,
      backgroundColor: s.background_color,
      textColor: s.text_color,
      image: s.image_url,
    }));
    
    return apiSlides.length > 0 ? apiSlides : carouselSlides;
    
  } catch (error) {
    console.error('Error obteniendo slides:', error);
    return carouselSlides;
  }
}

export default async function Home() {
  const realProducts = await getMyRealProducts();
  const featuredProducts = realProducts.filter((p: any) => p.featured).slice(0, 4);
  const products = realProducts.slice(0, 8);
  const slides = await getSlides();

  return (
    <div>
      {/* Carousel Hero Section */}
      <Carousel slides={slides} autoplayInterval={6000} />

      <section className="border-b border-gray-100 bg-white py-10">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Timbres de goma personalizados en Chile
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Sellos de caucho para empresas, pymes y emprendedores. Calidad de impresión, asesoría y
            despacho a todo el país.
          </p>
          <div className="mt-8 flex justify-center">
            <WhatsAppButton message="Hola Artesellos, quiero solicitar cotización por WhatsApp para un timbre de goma.">
              Solicitar cotización por WhatsApp
            </WhatsAppButton>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Productos Destacados
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Nuestros diseños más populares y queridos por nuestros clientes
            </p>
          </div>

          <ProductCarousel
            products={featuredProducts}
            emptyMessage="No hay productos destacados disponibles en este momento."
            prioritizeFirst={2}
          />
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Explora por Categorías
            </h2>
            <p className="text-lg text-gray-600">
              Encuentra el timbre perfecto para tu ocasión especial
            </p>
          </div>

          <Categorias />
        </div>
      </section>

      {/* All Products Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Todos los Productos
            </h2>
            <p className="text-lg text-gray-600">
              Explora nuestra colección completa de timbres personalizados
            </p>
          </div>

          <ProductGrid
            products={products}
            emptyMessage="No hay productos disponibles en este momento."
            prioritizeFirst={4}
          />

          <div className="text-center mt-12">
            <Link
              href="/productos"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-200"
            >
              Ver Todos los Productos
            </Link>
          </div>
        </div>
      </section>

      <HomeSeoContent />
    </div>
  );
}