import type { Metadata } from "next";
import { HomeCatalog } from '@/features/catalog/components/HomeCatalog';
import { listCatalogCategoriesWithCounts, listCatalogProductListings } from '@/features/catalog/server/queries';

export const metadata: Metadata = {
  title: "Insumos para velas, jabones y perfumería",
  description:
    "Materias primas, formatos y packaging para velas, jabones y perfumería.",
  keywords: [
    "insumos para velas",
    "insumos para jabones",
    "materias primas",
    "packaging",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Insumos para velas, jabones y perfumería",
    description:
      "Materias primas, formatos y packaging para crear.",
  },
};

export default async function Home() {
  const [listings, categories] = await Promise.all([
    listCatalogProductListings(),
    listCatalogCategoriesWithCounts(),
  ]);
  return <HomeCatalog listings={listings} categories={categories} />;
}
