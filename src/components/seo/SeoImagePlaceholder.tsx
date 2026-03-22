/** Bloque reservado para fotos de producto o diagramas (no rompe el layout). */
export default function SeoImagePlaceholder({ label }: { label?: string }) {
  return (
    <figure className="my-10">
      <div className="flex aspect-[16/10] items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
        {label ?? "Espacio para imagen"}
      </div>
    </figure>
  );
}
