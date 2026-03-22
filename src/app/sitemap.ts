import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const paths: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/timbres-personalizados", priority: 0.9, changeFrequency: "weekly" },
  { path: "/timbres-empresa", priority: 0.9, changeFrequency: "weekly" },
  { path: "/timbre-rut", priority: 0.9, changeFrequency: "weekly" },
  { path: "/timbres-automaticos", priority: 0.9, changeFrequency: "weekly" },
  { path: "/sellos-para-negocios", priority: 0.9, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.85, changeFrequency: "weekly" },
  { path: "/blog/como-hacer-un-timbre-de-empresa", priority: 0.8, changeFrequency: "monthly" },
  { path: "/blog/cuanto-cuesta-un-timbre-en-chile", priority: 0.8, changeFrequency: "monthly" },
  { path: "/blog/tipos-de-timbres", priority: 0.8, changeFrequency: "monthly" },
  { path: "/productos", priority: 0.85, changeFrequency: "daily" },
  { path: "/contacto", priority: 0.7, changeFrequency: "monthly" },
  { path: "/diseno-personalizado", priority: 0.7, changeFrequency: "monthly" },
  { path: "/sobre-nosotros", priority: 0.6, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return paths.map(({ path, priority, changeFrequency }) => ({
    url: path === "" ? SITE_URL : `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
