import type { MetadataRoute } from 'next';
import { PAGES, absoluteUrl } from '@/lib/site';

// The map is refreshed by the daily-update workflow; the other views change rarely.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: absoluteUrl(PAGES.map.path), lastModified, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl(PAGES.predictions.path), lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: absoluteUrl(PAGES.analytics.path), lastModified, changeFrequency: 'monthly', priority: 0.7 },
  ];
}
