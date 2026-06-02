'use client';

import { X, TrendingUp, TrendingDown, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Department, PredictionResponse, WeeklyForecast } from '@/lib/types';
import { useState } from 'react';
import { generateReport } from '@/lib/pdfReport';

interface Props {
  department: Department;
  predictions: PredictionResponse | null;
  onClose: () => void;
}

// Labels for the climate variables. Names match the backend exactly.
// `oni_lag4` is the ONI value 4 months prior — included because dengue
// dynamics respond with that lag to ENSO state.
const CLIMATE_LABELS: Record<string, string> = {
  temperature: 'Temperature',
  precipitation: 'Precipitation',
  humidity: 'Humidity',
  oni: 'ONI (current)',
  oni_lag4: 'ONI (lag 4 mo)',
};

export default function DepartmentSidebar({ department, predictions, onClose }: Props) {
  const forecasts: WeeklyForecast[] = predictions?.weekly_forecasts ?? [];
  const climate = predictions?.climate_influence;
  const [generatingReport, setGeneratingReport] = useState(false);

  const handleGenerateReport = async () => {
    if (!predictions) return;
    setGeneratingReport(true);
    try {
      await generateReport([predictions], { source: 'map' });
      toast.success('Report downloaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate report';
      toast.error(`Report failed: ${msg}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Compute the max absolute climate-influence value once. This is the
  // bar's reference for "100% wide". Climate values from the backend are
  // absolute case deltas (e.g. +12.5 cases if temperature rises 1 std),
  // NOT fractions of 1 — that's why we don't multiply by 100.
  const maxAbsClimate = climate
    ? Math.max(
      Math.abs(climate.temperature),
      Math.abs(climate.precipitation),
      Math.abs(climate.humidity),
      Math.abs(climate.oni),
      Math.abs(climate.oni_lag4),
    )
    : 0;

  return (
    <div className="sidebar-slide-in h-full flex flex-col overflow-y-auto">
      <div className="flex items-start justify-between p-5 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground">{department.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Department Code: <span className="font-mono">{String(department.code).padStart(2, '0')}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 p-5 space-y-5">
        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center">
            <Users size={16} className="text-cyan-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Population</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {department.population.toLocaleString()}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Predicted Cases</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {forecasts.map((f: WeeklyForecast, i: number) => (
              <div key={f.horizon} className="glass-card rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Week +{f.horizon}</span>
                  {i > 0 && (
                    f.trend === 'up'
                      ? <TrendingUp size={13} className="text-red-400" />
                      : <TrendingDown size={13} className="text-emerald-400" />
                  )}
                </div>
                <p className={cn(
                  // Coloring is intentionally based on absolute thresholds here
                  // because this is a rough visual cue per row, not the formal
                  // risk classification (which lives in `risk_level`).
                  'text-2xl font-bold tabular-nums',
                  f.cases > 400 ? 'text-red-400' :
                    f.cases > 150 ? 'text-orange-400' :
                      f.cases > 50 ? 'text-yellow-400' : 'text-emerald-400',
                )}>
                  {f.cases.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Week {f.horizon} forecast</p>
              </div>
            ))}
          </div>
        </div>

        {predictions?.risk_level && (
          <div className="glass-card rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Risk classification</span>
            <span
              className={cn(
                'text-sm font-bold uppercase tracking-wide',
                predictions.risk_level === 'low' && 'text-emerald-400',
                predictions.risk_level === 'medium' && 'text-yellow-400',
                predictions.risk_level === 'high' && 'text-orange-400',
                predictions.risk_level === 'very-high' && 'text-red-400',
              )}
            >
              {predictions.risk_level.replace('-', ' ')}
            </span>
          </div>
        )}

        {climate && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-0.5">Climate Variable Influence</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Estimated change in predicted cases when each variable rises by 1 std deviation
            </p>
            <div className="space-y-2.5">
              {(Object.entries(climate) as [string, number][]).map(([key, value]) => {
                // Bar width = this variable's magnitude relative to the largest in the set.
                // Always at least 4% so a non-zero value is still visible.
                const widthPct = maxAbsClimate > 0
                  ? Math.max(4, Math.round((Math.abs(value) / maxAbsClimate) * 100))
                  : 0;
                const positive = value >= 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{CLIMATE_LABELS[key] ?? key}</span>
                      <span className={cn(
                        'font-medium tabular-nums',
                        positive ? 'text-cyan-400' : 'text-orange-400',
                      )}>
                        {positive ? '+' : ''}{value.toFixed(2)} cases
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          positive ? 'bg-cyan-500' : 'bg-orange-500',
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="p-5 border-t border-border">
        <button
          onClick={handleGenerateReport}
          disabled={!predictions || generatingReport}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer shadow-lg',
            !predictions || generatingReport
              ? 'bg-muted text-muted-foreground cursor-wait shadow-none'
              : 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-cyan-500/25',
          )}
        >
          <FileText size={15} />
          {generatingReport ? 'Generating PDF…' : 'Generate Full Report'}
        </button>
      </div>
    </div>
  );
}