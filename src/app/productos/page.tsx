'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProducts, getCategories } from '@/lib/woocommerce';
import ProductCard from '@/components/ProductCard';
import { Product as ProductType } from '@/types/product';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  images: Array<{
    id: number;
    src: string;
    name: string;
    alt: string;
  }>;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  featured: boolean;
}

const convertWooCommerceToProductType = (wooProduct: WooCommerceProduct): ProductType => {
  return {
    id: wooProduct.id,
    name: wooProduct.name,
    slug: wooProduct.slug,
    description: wooProduct.description,
    short_description: wooProduct.short_description,
    price: wooProduct.price,
    regular_price: wooProduct.regular_price,
    sale_price: wooProduct.sale_price,
    on_sale: wooProduct.on_sale,
    images: wooProduct.images.map(img => ({
      id: img.id,
      src: img.src,
      name: img.name,
      alt: img.alt
    })),
    categories: wooProduct.categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug
    })),
    attributes: [],
    stock_status: wooProduct.stock_status,
    stock_quantity: null,
    weight: '',
    dimensions: { length: '', width: '', height: '' },
    tags: [],
    featured: wooProduct.featured,
    date_created: '',
    date_modified: ''
  };
};

interface Category {
  id: number;
  name: string;
  slug: string;
  count?: number;
}

const sortOptions = [
  { value: 'name', label: 'Nombre A-Z' },
  { value: '-name', label: 'Nombre Z-A' },
  { value: 'price', label: 'Precio: Menor a Mayor' },
  { value: '-price', label: 'Precio: Mayor a Menor' },
];

// Marcas ficticias (reemplazar con datos reales de Supabase)
const brands = ['Shiny', 'Trodat', 'Colop', 'Brother', 'Pronto'];

// Preposiciones y artículos que no aportan al filtro
const STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'a', 'en', 'que', 'es', 'por', 'con', 'para', 'al', 'se',
]);

const normalize = (str: string): string =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

export default function ProductosPage() {
  const [products, setProducts] = useState<ProductType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');
  
  // UI States
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [categoryExpanded, setCategoryExpanded] = useState(true);
  const [brandExpanded, setBrandExpanded] = useState(true);
  const [priceExpanded, setPriceExpanded] = useState(true);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadProducts();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCategories, selectedBrands, minPrice, maxPrice, sortBy]);

  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories();
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const result = await getProducts({ per_page: 100 });
      let filteredProducts = result.products || [];

      // Filtrar por categorías
      if (selectedCategories.length > 0) {
        filteredProducts = filteredProducts.filter(product =>
          product.categories.some(cat => selectedCategories.includes(cat.id.toString()))
        );
      }

      // Filtrar por marcas (simulado con nombre del producto)
      if (selectedBrands.length > 0) {
        filteredProducts = filteredProducts.filter(product =>
          selectedBrands.some(brand => product.name.toLowerCase().includes(brand.toLowerCase()))
        );
      }

      // Filtrar por búsqueda (nombre, categorías, descripción y tags)
      if (searchTerm.trim()) {
        const words = normalize(searchTerm)
          .split(' ')
          .filter(w => w.length > 1 && !STOP_WORDS.has(w));
        if (words.length > 0) {
          filteredProducts = filteredProducts.filter(product => {
            const haystack = [
              product.name,
              product.description || '',
              product.short_description || '',
              ...(product.categories || []).map((c: { name: string }) => c.name),
              ...(product.tags || []).map((t: { name: string }) => t.name),
            ]
              .filter(Boolean)
              .map(normalize)
              .join(' ');
            return words.every(word => haystack.includes(word));
          });
        }
      }

      // Filtrar por rango de precio
      if (minPrice || maxPrice) {
        filteredProducts = filteredProducts.filter(product => {
          const price = parseFloat(product.price);
          const min = minPrice ? parseFloat(minPrice) : 0;
          const max = maxPrice ? parseFloat(maxPrice) : Infinity;
          return price >= min && price <= max;
        });
      }

      // Ordenar
      filteredProducts.sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case '-name':
            return b.name.localeCompare(a.name);
          case 'price':
            return parseFloat(a.price) - parseFloat(b.price);
          case '-price':
            return parseFloat(b.price) - parseFloat(a.price);
          default:
            return 0;
        }
      });

      const convertedProducts = filteredProducts.map(convertWooCommerceToProductType);
      setProducts(convertedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setSelectedBrands([]);
    setMinPrice('');
    setMaxPrice('');
    setSortBy('name');
    setCurrentPage(1);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedCategories.length > 0) count += selectedCategories.length;
    if (selectedBrands.length > 0) count += selectedBrands.length;
    if (minPrice || maxPrice) count++;
    return count;
  };

  // Paginación
  const totalPages = Math.ceil(products.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  const getPaginationRange = () => {
    const range = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) range.push(i);
        range.push('...');
        range.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        range.push(1);
        range.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) range.push(i);
      } else {
        range.push(1);
        range.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) range.push(i);
        range.push('...');
        range.push(totalPages);
      }
    }
    
    return range;
  };

  // Componente de Sidebar de Filtros
  const FiltersSidebar = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
        {getActiveFiltersCount() > 0 && (
          <button
            onClick={clearFilters}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Categorías */}
      <div className="border-b border-gray-200 pb-6">
        <button
          onClick={() => setCategoryExpanded(!categoryExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Categorías
          </h3>
          {categoryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {categoryExpanded && (
          <div className="mt-4 space-y-3">
            {categories.slice(0, 8).map(category => (
              <label key={category.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category.id.toString())}
                  onChange={() => toggleCategory(category.id.toString())}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  {category.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Marcas */}
      <div className="border-b border-gray-200 pb-6">
        <button
          onClick={() => setBrandExpanded(!brandExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Marca
          </h3>
          {brandExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {brandExpanded && (
          <div className="mt-4 space-y-3">
            {brands.map(brand => (
              <label key={brand} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand)}
                  onChange={() => toggleBrand(brand)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  {brand}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Rango de Precio */}
      <div className="pb-6">
        <button
          onClick={() => setPriceExpanded(!priceExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Precio
          </h3>
          {priceExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {priceExpanded && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Mínimo</label>
              <input
                type="number"
                placeholder="$0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Máximo</label>
              <input
                type="number"
                placeholder="$100.000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Catálogo de Productos
          </h1>
          <p className="text-gray-600">
            {products.length} producto{products.length !== 1 ? 's' : ''} disponible{products.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Layout Principal: Sidebar + Grid */}
        <div className="lg:grid lg:grid-cols-[256px_1fr] lg:gap-8">
          
          {/* Sidebar de Filtros - Desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <FiltersSidebar />
            </div>
          </aside>

          {/* Columna Principal - Grid de Productos */}
          <div>
            {/* Barra Superior: Búsqueda + Ordenar + Filtros Móvil */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Búsqueda */}
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <svg className="absolute left-3 top-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Ordenar */}
                <div className="sm:w-48">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botón Filtros Móvil */}
                <button
                  onClick={() => setIsMobileFilterOpen(true)}
                  className="lg:hidden flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filtros</span>
                  {getActiveFiltersCount() > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-xs font-semibold text-white bg-indigo-600 rounded-full">
                      {getActiveFiltersCount()}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Grid de Productos */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="bg-white rounded-lg overflow-hidden border border-gray-200 animate-pulse">
                    <div className="aspect-square bg-gray-200" />
                    <div className="p-4 space-y-3">
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-5 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : currentProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {currentProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-12">
                    <nav className="flex items-center gap-1">
                      {/* Anterior */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                      >
                        Anterior
                      </button>

                      {/* Números de página */}
                      {getPaginationRange().map((page, index) => (
                        page === '...' ? (
                          <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-400">
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page as number)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg ${
                              currentPage === page
                                ? 'text-white bg-indigo-600 hover:bg-indigo-700'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      ))}

                      {/* Siguiente */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                      >
                        Siguiente
                      </button>
                    </nav>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 9l6 3" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchTerm.trim()
                    ? 'No encontramos productos para esta búsqueda.'
                    : 'No se encontraron productos'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm.trim()
                    ? `No hay resultados para "${searchTerm.trim()}". Intenta con otras palabras.`
                    : 'Intenta ajustar tus filtros.'}
                </p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Limpiar filtros
                </button>
              </div>
            )}

            {/* CTA */}
            <div className="mt-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold mb-3">
                ¿No encuentras lo que buscas?
              </h2>
              <p className="text-indigo-100 mb-6">
                Contáctanos y te ayudaremos a encontrar el producto perfecto
              </p>
              <div className="flex justify-center">
                <Link
                  href="/contacto"
                  className="px-8 py-3 text-sm font-semibold text-indigo-600 bg-white rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
                >
                  Contactar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer de Filtros Móvil */}
      {isMobileFilterOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileFilterOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-white z-50 lg:hidden overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filtros */}
              <FiltersSidebar />

              {/* Botones */}
              <div className="mt-8 space-y-3">
                <button
                  onClick={() => {
                    setIsMobileFilterOpen(false);
                  }}
                  className="w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Ver {products.length} producto{products.length !== 1 ? 's' : ''}
                </button>
                {getActiveFiltersCount() > 0 && (
                  <button
                    onClick={() => {
                      clearFilters();
                      setIsMobileFilterOpen(false);
                    }}
                    className="w-full px-4 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
