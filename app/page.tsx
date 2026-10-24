import MapView from '@/components/views/MapView';
import RiskOverview from '@/components/map/RiskOverview';
import JsonLd from '@/components/JsonLd';
import { fetchAllRisks } from '@/lib/api';
import { PAGES } from '@/lib/site';
import { pageJsonLd, pageMetadata } from '@/lib/seo';
import type { RiskSummary } from '@/lib/types';

export const metadata = pageMetadata('map');
export const revalidate = 3600;

async function loadRisks(): Promise<RiskSummary[]> {
  try {
    return await fetchAllRisks();
  } catch (err) {
    console.error('[MapPage] fetchAllRisks failed:', err);
    return [];
  }
}

export default async function MapPage() {
  const risks = await loadRisks();

  return (
    <>
      <JsonLd data={pageJsonLd('map')} />
      {/* The map is client-only, so the heading and summary keep the page meaningful in raw HTML */}
      <h1 className="sr-only">{PAGES.map.heading}</h1>
      <p className="sr-only">{PAGES.map.description}</p>
      <RiskOverview risks={risks} className="lg:hidden" />
      <MapView risks={risks} />
    </>
  );
}
