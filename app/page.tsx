import MapView from '@/components/views/MapView';
import JsonLd from '@/components/JsonLd';
import { PAGES } from '@/lib/site';
import { pageJsonLd, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('map');

export default function MapPage() {
  return (
    <>
      <JsonLd data={pageJsonLd('map')} />
      {/* The map is client-only, so the heading and summary keep the page meaningful in raw HTML */}
      <h1 className="sr-only">{PAGES.map.heading}</h1>
      <p className="sr-only">{PAGES.map.description}</p>
      <MapView />
    </>
  );
}
