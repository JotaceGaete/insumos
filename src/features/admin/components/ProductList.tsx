'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type VariantSummary = { id: string; name: string; sku: string; retail_price: number; stock_quantity: number; is_active: boolean };
type ProductRow = {
  id: string; name: string; slug: string; status: 'active' | 'draft' | 'archived'; is_featured: boolean;
  categories: { id: string; name: string } | null; product_variants: VariantSummary[];
};

function formatPrice(value: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

export function ProductList() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/insumos/admin/products')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No fue posible cargar productos.');
        setProducts(data.products || []);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Error inesperado.'))
      .finally(() => setLoading(false));
  }, []);

  const visible = products.filter((product) => {
    const text = `${product.name} ${product.slug} ${product.categories?.name || ''}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-bold text-stone-900">Productos</h1><p className="mt-1 text-sm text-stone-600">El precio y el stock pertenecen a cada variante.</p></div>
        <Link href="/admin/productos/nuevo" className="rounded-md bg-stone-900 px-4 py-2 text-center text-sm font-semibold text-white">Nuevo producto</Link>
      </div>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, slug o categoría" className="w-full rounded-md border border-stone-300 px-3 py-2" />
      {error && <p className="text-sm text-red-700">{error}</p>}
      {loading ? <p className="py-10 text-stone-500">Cargando productos...</p> : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Categoría</th><th className="px-4 py-3">Variantes</th><th className="px-4 py-3">Desde</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((product) => {
                const active = product.product_variants.filter((variant) => variant.is_active);
                const lowest = active.reduce<number | null>((price, variant) => price === null || variant.retail_price < price ? variant.retail_price : price, null);
                const stock = active.reduce((total, variant) => total + variant.stock_quantity, 0);
                return <tr key={product.id}><td className="px-4 py-3"><p className="font-medium text-stone-900">{product.name}</p><p className="text-xs text-stone-500">{product.slug}</p></td><td className="px-4 py-3 text-stone-600">{product.categories?.name || '-'}</td><td className="px-4 py-3 text-stone-600">{active.length}</td><td className="px-4 py-3 text-stone-900">{lowest === null ? '-' : formatPrice(lowest)}</td><td className="px-4 py-3 text-stone-600">{stock}</td><td className="px-4 py-3"><span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-700">{product.status}</span></td><td className="px-4 py-3 text-right"><Link href={`/admin/productos/${product.id}`} className="font-medium text-amber-800 hover:underline">Editar</Link></td></tr>;
              })}
              {visible.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-stone-500">No hay productos que coincidan.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
