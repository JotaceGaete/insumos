'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CatalogCategoryWithCount } from '@/features/catalog/server/queries';
import { getCategoryIcon, getCategoryPalette } from './categoryVisuals';

/**
 * Single horizontal row that scales to any number of categories (8, 15, 50...)
 * without ever wrapping to a second row. Desktop gets prev/next controls that
 * only render when content actually overflows; touch devices rely on native
 * swipe. Card size/count are never hardcoded — overflow is measured live.
 */
export function CategoryGrid({ categories }: { categories: CatalogCategoryWithCount[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, categories.length]);

  if (categories.length === 0) return null;

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const hasOverflow = canScrollLeft || canScrollRight;

  return (
    <section id="categorias" className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-insumos-ink sm:text-xl">Explora por categoría</h2>
        {hasOverflow && (
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              disabled={!canScrollLeft}
              aria-label="Ver categorías anteriores"
              className="grid h-8 w-8 place-items-center rounded-full border border-insumos-line bg-white text-insumos-forest transition-colors hover:bg-insumos-mint disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              disabled={!canScrollRight}
              aria-label="Ver más categorías"
              className="grid h-8 w-8 place-items-center rounded-full border border-insumos-line bg-white text-insumos-forest transition-colors hover:bg-insumos-mint disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        role="group"
        aria-label="Categorías, desplazamiento horizontal"
        tabIndex={0}
        className="scrollbar-hide mt-3 flex snap-x snap-proximity gap-3 overflow-x-auto scroll-smooth pb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-insumos-forest"
      >
        {categories.map((category, index) => {
          const Icon = getCategoryIcon(category.name);
          const palette = getCategoryPalette(index);
          return (
            <Link
              key={category.id}
              href={`/categoria/${category.slug}`}
              className="flex h-[104px] w-[160px] flex-shrink-0 snap-start items-center gap-3 rounded-2xl border border-insumos-line bg-white px-4 transition-shadow hover:shadow-md"
            >
              <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${palette.bg} ${palette.text}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-bold leading-tight text-insumos-ink">{category.name}</span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  {category.productCount} producto{category.productCount === 1 ? '' : 's'}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
