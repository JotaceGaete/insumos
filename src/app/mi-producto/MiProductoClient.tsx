'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

export default function MiProductoClient() {
  const [producto, setProducto] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        console.log('🚀 Cargando TU producto real desde Supabase...');
        
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { data: supabaseProducts, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .limit(1);
        
        if (fetchError) throw fetchError;
        
        if (supabaseProducts && supabaseProducts.length > 0) {
          const realProduct = supabaseProducts[0]; // Tu producto "Shiny S-722"
          
          // Convertir a formato simple para mostrar
          const productData = {
            id: realProduct.id,
            name: realProduct.name,
            slug: realProduct.slug,
            description: realProduct.description,
            short_description: realProduct.short_description,
            price: Math.round(realProduct.price),
            images: realProduct.images,
            stock_quantity: realProduct.stock_quantity,
            featured: realProduct.featured,
            categories: realProduct.categories,
            created_at: realProduct.created_at
          };
          
          setProducto(productData);
          console.log(`✅ ¡Tu producto cargado: ${productData.name}!`);
        }
      } catch (e: any) {
        setError(e.message);
        console.error('❌ Error:', e);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎯 TU Producto Real de Supabase
          </h1>
          <p className="text-lg text-gray-600">
            Esta página muestra tu producto real desde tu base de datos
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center mb-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Cargando tu producto...</h3>
            <p className="text-blue-700">Obteniendo datos desde Supabase</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-red-900 mb-2">❌ Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Tu Producto */}
        {!loading && producto ? (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
            <div className="md:flex">
              {/* Imagen */}
              <div className="md:w-1/2">
                <div className="h-96 bg-gray-100 flex items-center justify-center">
                  {typeof producto.images === 'string' ? (
                    <img 
                      src={producto.images}
                      alt={producto.name}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://media.artesellos.cl/sin-image-producto-artesellos.png';
                      }}
                    />
                  ) : (
                    <div className="text-gray-500">
                      <div className="text-6xl mb-4">📸</div>
                      <p>Imagen no disponible</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Información */}
              <div className="md:w-1/2 p-8">
                <div className="space-y-6">
                  
                  {/* Nombre y Precio */}
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      {producto.name}
                    </h2>
                    <div className="text-4xl font-bold text-green-600">
                      ${producto.price.toLocaleString('es-CL')}
                    </div>
                  </div>

                  {/* Descripción */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Descripción</h3>
                    <p className="text-gray-700">
                      {producto.description || producto.short_description || 'Sin descripción disponible'}
                    </p>
                  </div>

                  {/* Detalles */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900">Detalles del Producto</h3>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">ID:</span>
                        <p className="text-gray-900 truncate">{producto.id}</p>
                      </div>
                      
                      <div>
                        <span className="font-medium text-gray-600">Slug:</span>
                        <p className="text-gray-900">{producto.slug}</p>
                      </div>
                      
                      <div>
                        <span className="font-medium text-gray-600">Stock:</span>
                        <p className="text-gray-900">{producto.stock_quantity} unidades</p>
                      </div>
                      
                      <div>
                        <span className="font-medium text-gray-600">Destacado:</span>
                        <p className="text-gray-900">{producto.featured ? '⭐ Sí' : 'No'}</p>
                      </div>
                    </div>

                    {producto.categories && (
                      <div>
                        <span className="font-medium text-gray-600">Categorías:</span>
                        <p className="text-gray-900">{Array.isArray(producto.categories) ? producto.categories.join(', ') : producto.categories}</p>
                      </div>
                    )}
                  </div>

                  {/* Botones */}
                  <div className="flex space-x-4 pt-4">
                    <Link 
                      href={`/producto/${producto.slug}`}
                      className="flex-1 bg-indigo-600 text-white text-center py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Ver Página del Producto
                    </Link>
                    
                    <Link 
                      href="/supabase-demo"
                      className="flex-1 bg-gray-600 text-white text-center py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                      Ver Demo Técnico
                    </Link>
                  </div>

                </div>
              </div>
            </div>
          </div>
        ) : !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-yellow-900 mb-2">
              No se encontró tu producto
            </h3>
            <p className="text-yellow-700 mb-4">
              No se pudo cargar tu producto desde Supabase. Verifica que tengas productos en tu base de datos.
            </p>
            <Link 
              href="/supabase-demo"
              className="inline-block bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Ver Demo Técnico
            </Link>
          </div>
        )}

        {/* Enlaces de navegación */}
        <div className="text-center space-x-4">
          <Link 
            href="/"
            className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Volver al Inicio
          </Link>
          
          <Link 
            href="/productos"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Ver Todos los Productos
          </Link>
        </div>

      </div>
    </div>
  );
}

