'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Product } from '@/types/product';
import { Eye } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Función para sanear URLs de imagen
  const safeUrl = (url?: string) => {
    const placeholder = 'https://media.artesellos.cl/sin-image-producto-artesellos.png';
    if (!url || typeof url !== 'string') return placeholder;
    const trimmed = url.trim();
    if (!trimmed) return placeholder;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      return trimmed;
    }

    try {
      const base = (process.env.NEXT_PUBLIC_ASSETS_BASE_URL || 'https://artema.cl').replace(/\/+$/, '');
      let key = trimmed.replace(/^\/+/, '');
      key = key.replace(/^(timbres\/)/i, '');
      const encoded = key.split('/')
        .filter(Boolean)
        .map((seg) => encodeURIComponent(seg))
        .join('/');
      return `${base}/${encoded}`;
    } catch {
      return placeholder;
    }
  };

  const primaryImage = safeUrl(product.images?.[0]?.src || (product as any).images?.[0]);
  const secondaryImage = safeUrl(product.images?.[1]?.src || (product as any).images?.[1]) || primaryImage;
  const currentImage = isHovered && product.images.length > 1 ? secondaryImage : primaryImage;

  // Formatear precio
  const formatCurrency = (price: string) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(parseFloat(price));
  };

  // Obtener marca o categoría principal
  const brand = product.categories?.[0]?.name || 'ARTEMA';

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group block bg-white rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Contenedor de Imagen - Aspect Square */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {/* Imagen del producto */}
        <div className="absolute inset-0 p-4">
          <div className="relative w-full h-full">
            <Image
              src={currentImage}
              alt={product.images?.[0]?.alt || product.name}
              fill
              className={`object-contain transition-all duration-500 ${
                isHovered ? 'scale-105' : 'scale-100'
              } ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://media.artesellos.cl/sin-image-producto-artesellos.png';
                setImageLoaded(true);
              }}
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </div>
        </div>

        {/* Skeleton mientras carga */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}

        {/* Badge de producto destacado */}
        {product.featured && (
          <span className="absolute top-3 left-3 px-2 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md shadow-sm">
            Destacado
          </span>
        )}

        {/* Badge de sin stock */}
        {product.stock_status === 'outofstock' && (
          <span className="absolute top-3 right-3 px-2 py-1 text-xs font-semibold text-white bg-red-600 rounded-md shadow-sm">
            Agotado
          </span>
        )}

        {/* Botón flotante "Ver" - aparece en hover */}
        <div
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 transition-all duration-300 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-lg hover:bg-indigo-700 transition-colors">
            <Eye className="w-4 h-4" />
            <span>Ver</span>
          </div>
        </div>
      </div>

      {/* Información del Producto */}
      <div className="p-4 space-y-2">
        {/* Marca (pequeña, gris) */}
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
          {brand}
        </p>

        {/* Nombre del producto (negrita, truncado a 2 líneas) */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
          {product.name}
        </h3>

        {/* Precio (destacado, color primario) */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-bold text-indigo-600">
            {formatCurrency(product.price)}
          </span>

          {/* Estado de stock (texto pequeño) */}
          {product.stock_status === 'instock' && (
            <span className="text-xs text-green-600 font-medium">
              ✓ Disponible
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
