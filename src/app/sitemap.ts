import type { MetadataRoute } from 'next';
import { dispensaries } from '@/lib/data';
import { brandSummaries } from '@/lib/shelf';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

/* Every page a search engine should know about: the fixed pages, every
   licensed shop and every brand on a shelf. The site is rebuilt with each
   day's shelves, so the build time is when the pages last changed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const built = new Date();
  const page = (path: string, changeFrequency: 'daily' | 'weekly' | 'monthly', priority: number) => ({
    url: `${SITE_URL}${path}`,
    lastModified: built,
    changeFrequency,
    priority,
  });
  return [
    page('/', 'daily', 1),
    page('/menus/', 'daily', 0.9),
    page('/menus/shops/', 'daily', 0.8),
    page('/menus/brands/', 'daily', 0.8),
    page('/moves/', 'daily', 0.8),
    page('/map/', 'weekly', 0.6),
    page('/westchester/', 'weekly', 0.6),
    page('/long-island/', 'weekly', 0.5),
    page('/upstate/', 'weekly', 0.5),
    page('/about/', 'monthly', 0.3),
    page('/legal/', 'monthly', 0.2),
    ...dispensaries.map((d) => page(`/dispensary/${d.id}/`, 'daily', 0.7)),
    ...brandSummaries().map((b) => page(`/menus/brands/${b.key}/`, 'daily', 0.6)),
  ];
}
