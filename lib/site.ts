// Single source of truth for SEO metadata: base URL, site identity and the
// per-route titles/descriptions shared by metadata, OG images, sitemap and JSON-LD.

export const SITE_URL = 'https://epiguardapp.vercel.app';
export const SITE_NAME = 'EpiGuard';
export const SITE_DESCRIPTION =
  'Epidemiological early-warning platform that forecasts dengue risk up to 4 weeks ahead across Colombia’s 32 departments using SARIMAX models, climate data and the Oceanic Niño Index.';
export const SITE_AUTHOR = 'Lucas Romero';

export type PageKey = 'map' | 'predictions' | 'analytics';

export const PAGES: Record<PageKey, { path: string; title: string; heading: string; description: string }> = {
  map: {
    path: '/',
    title: 'Dengue Risk Map of Colombia',
    heading: 'Dengue Risk Map of Colombia',
    description:
      'Interactive map of current dengue risk for each Colombian department, with 4-week case forecasts and the climate factors driving each prediction.',
  },
  predictions: {
    path: '/predictions',
    title: 'On-demand Dengue Predictions',
    heading: 'On-demand Dengue Predictions',
    description:
      'Upload weekly dengue case counts (CSV, JSON or XLSX), select departments and run SARIMAX forecasts with risk levels and a downloadable PDF report.',
  },
  analytics: {
    path: '/analytics',
    title: 'Model Performance Analytics',
    heading: 'Model Performance',
    description:
      'Evaluation of SARIMA, SARIMAX, Neural Network, ElasticNet, Random Forest and XGBoost dengue forecasting models on the 2022–2023 held-out test set.',
  },
};

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();
