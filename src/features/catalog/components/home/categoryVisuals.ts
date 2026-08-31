import type { LucideIcon } from 'lucide-react';
import { Flame, Droplet, SprayCan, Palette, Package, Leaf } from 'lucide-react';

const ICON_BY_KEYWORD: Array<{ keyword: string; icon: LucideIcon }> = [
  { keyword: 'cera', icon: Flame },
  { keyword: 'aceite', icon: Droplet },
  { keyword: 'fragan', icon: SprayCan },
  { keyword: 'perfum', icon: SprayCan },
  { keyword: 'color', icon: Palette },
  { keyword: 'envase', icon: Package },
  { keyword: 'packaging', icon: Package },
];

const PASTELS = [
  { bg: 'bg-orange-50', text: 'text-orange-700' },
  { bg: 'bg-pink-50', text: 'text-pink-700' },
  { bg: 'bg-insumos-mint', text: 'text-insumos-forest' },
  { bg: 'bg-amber-50', text: 'text-amber-700' },
  { bg: 'bg-sky-50', text: 'text-sky-700' },
  { bg: 'bg-insumos-sand', text: 'text-stone-700' },
];

/** Neutral, deterministic icon per category name — no per-category data needed. */
export function getCategoryIcon(name: string): LucideIcon {
  const normalized = name.toLocaleLowerCase('es-CL');
  const match = ICON_BY_KEYWORD.find(({ keyword }) => normalized.includes(keyword));
  return match?.icon || Leaf;
}

export function getCategoryPalette(index: number) {
  return PASTELS[index % PASTELS.length];
}
