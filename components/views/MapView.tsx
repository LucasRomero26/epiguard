'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import DepartmentSidebar from '@/components/map/DepartmentSidebar';
import RiskLegend from '@/components/map/RiskLegend';
import { fetchPredictions } from '@/lib/api';
import { getDepartmentByCode } from '@/lib/data/departments';
import type { PredictionResponse } from '@/lib/types';
import type { Department } from '@/lib/types';

function SidebarSkeleton({ deptName, deptCode, onClose }: { deptName: string; deptCode: number; onClose: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-start justify-between p-5 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground">{deptName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{String(deptCode).padStart(2, '0')}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-muted-foreground cursor-pointer">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 p-5 space-y-5">
        <div className="skeleton h-14 rounded-xl w-full" />
        <div className="space-y-2">
          <div className="skeleton h-4 rounded w-32" />
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-4 rounded w-44" />
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton h-6 rounded w-full" />)}
        </div>
      </div>
    </div>
  );
}

const ColombiaMap = dynamic(() => import('@/components/map/ColombiaMap'), { ssr: false });

export default function MapView() {
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
    <div className="relative w-full" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="absolute inset-0">
        <ColombiaMap
          onDepartmentClick={handleDepartmentClick}
          selectedCode={selectedCode}
          highlightedCodes={null}
        />
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
