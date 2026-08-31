import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import { Leaf, ArrowRight } from 'lucide-react';

const HERO_IMAGE_PUBLIC_PATH = '/hero-insumos.png';
const HERO_IMAGE_FILE_PATH = path.join(process.cwd(), 'public', 'hero-insumos.png');

/**
 * Single real banner today. Shaped as a list so a future slider (offers, new
 * lines, seasons) only needs to map over more entries — no dots/arrows are
 * built now since there is nothing real to switch between yet.
 */
const slides = [
  {
    badge: 'Insumos de calidad',
    title: 'Materias primas para ',
    titleAccent: 'tus ideas',
    subtitle: 'Insumos para velas, jabones, perfumería, cosmética y packaging.',
    ctaLabel: 'Ver productos',
    ctaHref: '/productos',
  },
];

/**
 * Renders the real banner photo when public/hero-insumos.png exists; otherwise
 * falls back to a local, elegant SVG placeholder — never an external image URL.
 * The photo has clean crema space on the left and the wax bowl/bottles/soap
 * cluster on the right, so object-position is tuned per breakpoint to keep
 * that cluster in frame instead of defaulting to a plain center crop.
 */
function HeroVisual() {
  if (fs.existsSync(HERO_IMAGE_FILE_PATH)) {
    return (
      <Image
        src={HERO_IMAGE_PUBLIC_PATH}
        alt="Bowl de cera de coco, aceites y jabones artesanales sobre un mesón crema"
        fill
        priority
        sizes="(min-width: 1024px) 40vw, 100vw"
        className="object-cover object-[50%_68%] lg:object-[50%_70%]"
      />
    );
  }

  return (
    <svg
      viewBox="0 0 600 300"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Ilustración de materias primas para crear"
    >
      <defs>
        <linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EDE4D3" />
          <stop offset="100%" stopColor="#E4EFE3" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill="url(#hero-bg)" />
      <circle cx="180" cy="150" r="110" fill="#FBF7EE" opacity="0.9" />
      <circle cx="180" cy="150" r="86" fill="#EDE4D3" />
      <circle cx="420" cy="110" r="55" fill="#4C7A5E" opacity="0.18" />
      <rect x="385" y="90" width="55" height="120" rx="27" fill="#FBF7EE" stroke="#1F3D2B" strokeWidth="3" opacity="0.9" />
      <rect x="396" y="76" width="32" height="24" rx="7" fill="#1F3D2B" opacity="0.7" />
    </svg>
  );
}

export function Hero() {
  const slide = slides[0];

  return (
    <section className="border-b border-insumos-line bg-insumos-cream">
      <div className="mx-auto grid max-w-7xl items-center gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:gap-10 lg:px-8 lg:py-6">
        <div>
          {slide.badge && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-insumos-mint px-3 py-1 text-xs font-semibold text-insumos-forest">
              <Leaf className="h-3.5 w-3.5" aria-hidden />
              {slide.badge}
            </span>
          )}
          <h1 className="mt-2 text-2xl font-extrabold leading-[1.15] tracking-tight text-insumos-ink sm:text-4xl lg:mt-3 lg:text-[44px] lg:leading-[1.1]">
            {slide.title}
            <span className="font-display italic font-normal text-insumos-sage">{slide.titleAccent}</span>
          </h1>
          <p className="mt-2 max-w-md text-sm text-stone-600 sm:text-base lg:mt-3 lg:max-w-none">{slide.subtitle}</p>
          <Link
            href={slide.ctaHref}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-insumos-forest px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-insumos-forest-dark lg:mt-4"
          >
            {slide.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="relative h-24 w-full overflow-hidden rounded-2xl sm:h-40 lg:h-[175px]">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
