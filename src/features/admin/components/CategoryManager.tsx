'use client';

import { useEffect, useState } from 'react';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
};

type CategoryForm = {
  name: string;
  slug: string;
  parent_id: string;
  description: string;
  is_active: boolean;
  sort_order: string;
};

const emptyForm: CategoryForm = {
  name: '',
  slug: '',
  parent_id: '',
  description: '',
  is_active: true,
  sort_order: '0',
};

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadCategories() {
    const response = await fetch('/api/insumos/admin/categories');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No fue posible cargar categorías.');
    setCategories(data.categories || []);
  }

  useEffect(() => {
    loadCategories().catch((caught) => setFeedback({ kind: 'error', text: caught instanceof Error ? caught.message : 'No fue posible cargar categorías.' }));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        editingId ? `/api/insumos/admin/categories/${editingId}` : '/api/insumos/admin/categories',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            slug: form.slug,
            parent_id: form.parent_id || null,
            description: form.description || null,
            is_active: form.is_active,
            sort_order: Number(form.sort_order),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo guardar la categoría.');

      setForm(emptyForm);
      setEditingId(null);
      await loadCategories();
      setFeedback({ kind: 'success', text: editingId ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.' });
    } catch (caught) {
      setFeedback({ kind: 'error', text: caught instanceof Error ? caught.message : 'No se pudo guardar la categoría.' });
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(category: Category) {
    setFeedback(null);
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id || '',
      description: category.description || '',
      is_active: category.is_active,
      sort_order: String(category.sort_order),
    });
  }

  const actionLabel = editingId ? 'Guardar categoría' : 'Crear categoría';
  const savingLabel = editingId ? 'Guardando...' : 'Creando...';

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Categorías</h1>
        <p className="mt-1 text-sm text-stone-600">Crea categorías raíz y subcategorías. La base de datos bloquea ciclos.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-stone-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-stone-800">
            Nombre
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded border border-stone-300 p-2" />
          </label>
          <label className="text-sm font-medium text-stone-800">
            Slug
            <input required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} className="mt-1 w-full rounded border border-stone-300 p-2" />
          </label>
          <label className="text-sm font-medium text-stone-800">
            Categoría superior
            <select value={form.parent_id} onChange={(event) => setForm({ ...form, parent_id: event.target.value })} className="mt-1 w-full rounded border border-stone-300 p-2">
              <option value="">Sin categoría superior</option>
              {categories.filter((category) => category.id !== editingId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-stone-800">
            Orden
            <input type="number" min="0" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} className="mt-1 w-full rounded border border-stone-300 p-2" />
          </label>
          <label className="text-sm font-medium text-stone-800 sm:col-span-2">
            Descripción
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 min-h-20 w-full rounded border border-stone-300 p-2" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-800 sm:col-span-2">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            Activa
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
          <button type="submit" disabled={isSaving} className="rounded-md bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? savingLabel : actionLabel}
          </button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setFeedback(null); }} className="rounded-md border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700">Cancelar</button>}
        </div>
      </form>

      {feedback && <p role="status" className={`rounded-md border p-3 text-sm ${feedback.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{feedback.text}</p>}

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500"><tr><th className="p-3">Nombre</th><th className="p-3">Superior</th><th className="p-3">Estado</th><th className="p-3" /></tr></thead>
          <tbody>
            {categories.map((category) => <tr key={category.id} className="border-t border-stone-100"><td className="p-3"><p className="font-medium">{category.name}</p><p className="text-xs text-stone-500">{category.slug}</p></td><td className="p-3">{categories.find((parent) => parent.id === category.parent_id)?.name || '-'}</td><td className="p-3">{category.is_active ? 'Activa' : 'Inactiva'}</td><td className="p-3 text-right"><button type="button" onClick={() => startEdit(category)} className="text-amber-800 hover:underline">Editar</button></td></tr>)}
            {categories.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-stone-500">Aún no hay categorías.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
