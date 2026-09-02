'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type CustomerListItem = {
  id: string;
  fullName: string | null;
  emailNormalized: string;
  phoneNormalized: string | null;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number | null;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
};

type ListResponse = { customers: CustomerListItem[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function formatPrice(value: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(value));
}

export function CustomerList() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the raw input into `search`, and reset back to page 1 whenever
  // the search term actually changes — otherwise a stale page number could
  // point past the end of a newly-narrowed result set.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(inputValue.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) params.set('search', search);
    fetch(`/api/insumos/admin/customers?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No fue posible cargar los clientes.');
        const result = data as ListResponse;
        setCustomers(result.customers);
        setTotal(result.total);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Error inesperado.'))
      .finally(() => setLoading(false));
  }, [search, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Clientes</h1>
        <p className="mt-1 text-sm text-stone-600">Compras, gasto y contacto derivados de los pedidos de cada cliente.</p>
      </div>

      <input
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder="Buscar por nombre, email o teléfono"
        className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-stone-500">Cargando clientes...</p>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-10 text-center text-stone-500">
          {search ? 'No hay clientes que coincidan con la búsqueda.' : 'Todavía no hay clientes registrados.'}
        </div>
      ) : (
        <>
          {/* Desktop: table. Mobile: cards — a horizontally-scrolling table
              of this many columns is not usable on a phone. */}
          <div className="hidden overflow-x-auto rounded-lg border border-stone-200 bg-white md:block">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Compras</th>
                  <th className="px-4 py-3">Total gastado</th>
                  <th className="px-4 py-3">Ticket promedio</th>
                  <th className="px-4 py-3">Última compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/clientes/${customer.id}`} className="font-medium text-amber-800 hover:underline">
                        {customer.fullName || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{customer.emailNormalized}</td>
                    <td className="px-4 py-3 text-stone-600">{customer.phoneNormalized || '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{customer.totalOrders}</td>
                    <td className="px-4 py-3 text-stone-900">{formatPrice(customer.totalSpent)}</td>
                    <td className="px-4 py-3 text-stone-600">{customer.averageOrderValue === null ? '—' : formatPrice(customer.averageOrderValue)}</td>
                    <td className="px-4 py-3 text-stone-600">{formatDate(customer.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/admin/clientes/${customer.id}`}
                  className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-amber-300"
                >
                  <p className="font-medium text-stone-900">{customer.fullName || '—'}</p>
                  <p className="text-xs text-stone-500">{customer.emailNormalized}</p>
                  <p className="text-xs text-stone-500">{customer.phoneNormalized || '—'}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-600">
                    <span>Compras: <strong className="text-stone-900">{customer.totalOrders}</strong></span>
                    <span>Última: <strong className="text-stone-900">{formatDate(customer.lastOrderAt)}</strong></span>
                    <span>Total: <strong className="text-stone-900">{formatPrice(customer.totalSpent)}</strong></span>
                    <span>Ticket prom.: <strong className="text-stone-900">{customer.averageOrderValue === null ? '—' : formatPrice(customer.averageOrderValue)}</strong></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-sm text-stone-600">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-md border border-stone-300 px-3 py-1.5 disabled:opacity-40"
            >
              Anterior
            </button>
            <span>Página {page} de {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-stone-300 px-3 py-1.5 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </section>
  );
}
