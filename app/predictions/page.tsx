import PredictionsView from '@/components/views/PredictionsView';
import JsonLd from '@/components/JsonLd';
import { PAGES } from '@/lib/site';
import { pageJsonLd, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('predictions');

export default function PredictionsPage() {
  return (
    <>
      <JsonLd data={pageJsonLd('predictions')} />
      <h1 className="sr-only">{PAGES.predictions.heading}</h1>
      <p className="sr-only">{PAGES.predictions.description}</p>
      <PredictionsView />
    </>
  );
}
