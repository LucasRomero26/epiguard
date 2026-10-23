import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { PAGES, SITE_NAME, type PageKey } from '@/lib/site';

export const OG_SIZE = { width: 1200, height: 630 };

// Shared 1200x630 social card; each route's opengraph-image/twitter-image
// file calls this with its own key so previews show the page title.
export async function renderOgImage(key: PageKey) {
  const { title, description } = PAGES[key];
  const icon = await readFile(join(process.cwd(), 'app', 'icon.png'));
  const iconSrc = `data:image/png;base64,${icon.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 55%, #083344 100%)',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc} alt="" width={72} height={72} />
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>
            <span style={{ color: '#06b6d4' }}>Epi</span>
            <span>Guard</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 30, color: '#94a3b8', lineHeight: 1.35 }}>{description}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: '#22d3ee' }}>
          {`${SITE_NAME} · Dengue early-warning platform for Colombia`}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
