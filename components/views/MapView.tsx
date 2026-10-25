'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import DepartmentSidebar from '@/components/map/DepartmentSidebar';
import SidebarSkeleton from '@/components/map/SidebarSkeleton';
import RiskLegend from '@/components/map/RiskLegend';
import { fetchPredictions } from '@/lib/api';
import { getDepartmentByCode } from '@/lib/data/departments';
import type { Department, PredictionResponse, RiskSummary } from '@/lib/types';

const MapPlaceholder = () => <div className="skeleton h-full w-full" />;

const ColombiaMap = dynamic(() => import('@/components/map/ColombiaMap'), {
  ssr: false,
  loading: MapPlaceholder,
});

function useDeferredMount(ref: RefObject<Element | null>) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hasIdle = typeof window.requestIdleCallback === 'function';
    let handle: number | undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const mount = () => setReady(true);
      handle = hasIdle
        ? window.requestIdleCallback(mount, { timeout: 2000 })
        : window.setTimeout(mount, 200);
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (handle === undefined) return;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [ref]);

  return ready;
}

export default function MapView({ risks }: { risks: RiskSummary[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapReady = useDeferredMount(containerRef);
  const [selectedCode, setSelectedCode] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  const handleDepartmentClick = useCallback(async (code: number) => {
    if (selectedCode === code) {
      setSelectedCode(null);
      setSelectedDept(null);
      setPredictions(null);
      return;
    }
    setSelectedCode(code);
    const dept = getDepartmentByCode(code);
    setSelectedDept(dept ?? null);
    setPredictions(null);
    setLoadingPredictions(true);
    try {
      const data = await fetchPredictions(code);
      setPredictions(data);
    } finally {
      setLoadingPredictions(false);
    }
  }, [selectedCode]);

  const handleClose = useCallback(() => {
    setSelectedCode(null);
    setSelectedDept(null);
    setPredictions(null);
  }, []);

  // Escape key to close sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const sidebarOpen = !!selectedDept;

  return (
    <div
      id="risk-map"
      ref={containerRef}
      className="relative w-full scroll-mt-14 h-[75svh] lg:h-[calc(100vh-56px)]"
    >
      <div className="absolute inset-0">
        {mapReady ? (
          <ColombiaMap
            onDepartmentClick={handleDepartmentClick}
            selectedCode={selectedCode}
            highlightedCodes={null}
            initialRisks={risks}
          />
        ) : (
          <MapPlaceholder />
        )}
      </div>

      {/* Legend shifts left when the sidebar is open */}
      <div
        className="absolute top-4 z-20 transition-all duration-300"
        style={{ right: sidebarOpen ? 436 : 16 }}
      >
        <RiskLegend selectedDeptCode={selectedCode} />
      </div>

      {sidebarOpen && selectedDept && (
        <div className="absolute right-0 top-0 bottom-0 z-10 w-[420px] glass-card border-l border-border overflow-hidden">
          {loadingPredictions ? (
            <SidebarSkeleton deptName={selectedDept.name} deptCode={selectedDept.code} onClose={handleClose} />
          ) : (
            <DepartmentSidebar
              department={selectedDept}
              predictions={predictions}
              onClose={handleClose}
            />
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 hidden max-[1024px]:block">
        <div className="glass rounded-full px-4 py-1.5 text-xs text-muted-foreground">
          Best viewed on desktop
        </div>
      </div>
    </div>
  );
}
