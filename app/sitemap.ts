import type { MetadataRoute } from 'next';
import { PAGES, absoluteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl(PAGES.map.path), lastModified: PAGES.map.lastModified, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl(PAGES.predictions.path), lastModified: PAGES.predictions.lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: absoluteUrl(PAGES.analytics.path), lastModified: PAGES.analytics.lastModified, changeFrequency: 'monthly', priority: 0.7 },
  ];
}
