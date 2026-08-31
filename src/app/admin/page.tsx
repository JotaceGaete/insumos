import Link from 'next/link';

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Administración de insumos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/admin/productos" className="block rounded-lg border p-4 transition-shadow hover:shadow-sm">
          <div className="font-semibold">Productos</div>
          <div className="text-sm text-gray-500">Listar y administrar productos</div>
        </Link>
        <Link href="/admin/productos/nuevo" className="block rounded-lg border p-4 transition-shadow hover:shadow-sm">
          <div className="font-semibold">Nuevo producto</div>
          <div className="text-sm text-gray-500">Crear un producto desde cero</div>
        </Link>
        <Link href="/admin/categorias" className="block rounded-lg border p-4 transition-shadow hover:shadow-sm">
          <div className="font-semibold">Categorías</div>
          <div className="text-sm text-gray-500">Organizar categorías y subcategorías</div>
        </Link>
      </div>
    </div>
  )
}


