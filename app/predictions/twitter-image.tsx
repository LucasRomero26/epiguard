import { renderOgImage, OG_SIZE } from '@/lib/og';
import { PAGES, SITE_NAME } from '@/lib/site';

export const alt = `${PAGES.predictions.title} | ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderOgImage('predictions');
}
