import { Leaf, Truck, ShieldCheck, Headphones } from 'lucide-react';

const items = [
  { icon: Leaf, title: 'Calidad garantizada', description: 'Insumos seleccionados con altos estándares.' },
  { icon: Truck, title: 'Envíos a todo Chile', description: 'Despachos rápidos y seguros.' },
  { icon: ShieldCheck, title: 'Compra segura', description: 'Protegemos tus datos y tu compra.' },
  { icon: Headphones, title: 'Atención personalizada', description: 'Te ayudamos a encontrar lo que necesitas.' },
];

export function TrustStrip() {
  return (
    <section className="border-t border-insumos-line bg-insumos-mint/40">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
        {items.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-white text-insumos-forest">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold text-insumos-ink">{title}</span>
              <span className="mt-0.5 block text-xs text-stone-600">{description}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
