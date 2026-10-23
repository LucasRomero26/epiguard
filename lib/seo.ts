import type { Metadata } from 'next';
import { PAGES, SITE_AUTHOR, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl, type PageKey } from '@/lib/site';

// Next shallow-merges `openGraph`/`twitter` per segment, so every page must
// repeat the shared fields instead of relying on the root layout.
export function pageMetadata(key: PageKey): Metadata {
  const { path, title, description } = PAGES[key];
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    // `absolute` because the root page shares the layout's segment, where the title template does not apply.
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: path,
      title: fullTitle,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  };
}

// JSON-LD for a single route: the WebPage itself plus its breadcrumb trail.
export function pageJsonLd(key: PageKey) {
  const { path, title, description } = PAGES[key];
  const url = absoluteUrl(path);
  const crumbs = [{ name: SITE_NAME, url: absoluteUrl('/') }];
  if (path !== '/') crumbs.push({ name: title, url });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: `${title} | ${SITE_NAME}`,
        description,
        inLanguage: 'en',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#app` },
        primaryImageOfPage: absoluteUrl(path === '/' ? '/opengraph-image' : `${path}/opengraph-image`),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: c.url,
        })),
      },
    ],
  };
}

// Site-wide JSON-LD rendered once from the root layout.
export const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: 'en',
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web browser',
      inLanguage: 'en',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@type': 'Person', name: SITE_AUTHOR },
      spatialCoverage: { '@type': 'Country', name: 'Colombia' },
      keywords: 'dengue, Colombia, epidemiology, early warning, SARIMAX, forecasting, public health',
    },
  ],
};
