'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import MapView from '@/components/views/MapView';
import PredictionsView from '@/components/views/PredictionsView';
import AnalyticsView from '@/components/views/AnalyticsView';

type View = 'map' | 'predictions' | 'analytics';

export default function HomePage() {
  const [activeView, setActiveView] = useState<View>('map');

  return (
    <div className="min-h-screen bg-background">
      <Navbar activeView={activeView} onViewChange={setActiveView} />
      <main className="pt-14">
        {activeView === 'map'         && <MapView />}
        {activeView === 'predictions' && <PredictionsView />}
        {activeView === 'analytics'   && <AnalyticsView />}
      </main>
    </div>
  );
}
