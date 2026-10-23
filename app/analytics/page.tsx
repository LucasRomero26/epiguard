import AnalyticsView from '@/components/views/AnalyticsView';
import JsonLd from '@/components/JsonLd';
import { pageJsonLd, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('analytics');

// AnalyticsView renders the page's visible <h1>.
export default function AnalyticsPage() {
  return (
    <>
      <JsonLd data={pageJsonLd('analytics')} />
      <AnalyticsView />
    </>
  );
}
