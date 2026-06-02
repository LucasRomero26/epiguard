'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface RiskLegendProps {
  /**
   * If provided, the legend shows the percentile thresholds for that
   * specific department. If null/undefined, shows a generic explanation.
   */
  selectedDeptCode?: number | null;
  /**
   * Compact mode reduces padding, font sizes, and trims the explanatory
   * text so the legend takes ~half the visual real estate. Use it when
   * the map is in a smaller container (e.g. Predictions results panel).
   */
  compact?: boolean;
}

interface DeptThresholds {
  name: string;
  risk_p50: number;
  risk_p80: number;
  risk_p95: number;
}

const RISK_COLORS = [
  { color: '#22c55e', label: 'Low' },
  { color: '#eab308', label: 'Medium' },
  { color: '#f97316', label: 'High' },
  { color: '#ef4444', label: 'Very High' },
];

/**
 * Risk classification legend. Two modes:
 *   - When a department is selected on the map, shows that dept's
 *     percentile-based thresholds (e.g. Valle del Cauca: <138/<354/<712).
 *   - Otherwise, shows a generic explanation that thresholds are per-dept.
 */
export default function RiskLegend({ selectedDeptCode, compact = false }: RiskLegendProps) {
  const [thresholds, setThresholds] = useState<DeptThresholds | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (selectedDeptCode == null) {
      setThresholds(null);
      return;
    }

    setLoading(true);
    supabase
      .from('departments')
      .select('name,risk_p50,risk_p80,risk_p95')
      .eq('code', selectedDeptCode)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setThresholds(null);
        } else {
          setThresholds({
            name: data.name,
            risk_p50: Number(data.risk_p50),
            risk_p80: Number(data.risk_p80),
            risk_p95: Number(data.risk_p95),
          });
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedDeptCode]);

  // Style tokens keyed by compact flag — all size overrides in one place to prevent drift
  const s = compact
    ? {
      container: 'p-3 min-w-[160px]',
      title: 'text-xs font-semibold',
      subtitle: 'text-[10px] mb-2',
      rowGap: 'gap-1.5',
      dot: 'w-2.5 h-2.5',
      label: 'text-[11px] font-medium',
      range: 'text-[9px]',
      footnote: 'text-[9px] mt-2 pt-1.5',
    }
    : {
      container: 'p-4 min-w-[220px]',
      title: 'text-sm font-semibold',
      subtitle: 'text-[11px] mb-3',
      rowGap: 'gap-2',
      dot: 'w-3 h-3',
      label: 'text-xs font-medium',
      range: 'text-[10px]',
      footnote: 'text-[10px] mt-3 pt-2',
    };

  if (thresholds) {
    const { risk_p50, risk_p80, risk_p95, name } = thresholds;
    const items = [
      { color: '#22c55e', label: 'Low', range: `< ${formatNum(risk_p50)}/wk` },
      { color: '#eab308', label: 'Medium', range: `${formatNum(risk_p50)}–${formatNum(risk_p80)}/wk` },
      { color: '#f97316', label: 'High', range: `${formatNum(risk_p80)}–${formatNum(risk_p95)}/wk` },
      { color: '#ef4444', label: 'Very High', range: `> ${formatNum(risk_p95)}/wk` },
    ];
    return (
      <div className={cn('glass-card rounded-xl', s.container)}>
        <h3 className={cn('text-foreground', s.title)}>Risk Level</h3>
        <p className={cn('text-muted-foreground', s.subtitle)}>
          {compact ? name : `Thresholds for ${name}`}
        </p>
        <div className={cn('flex flex-col', s.rowGap)}>
          {items.map(({ color, label, range }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn('rounded-full flex-shrink-0', s.dot)}
                style={{ backgroundColor: color }}
              />
              <div className="flex flex-col leading-tight">
                <span className={cn('text-foreground', s.label)}>{label}</span>
                <span className={cn('text-muted-foreground', s.range)}>{range}</span>
              </div>
            </div>
          ))}
        </div>
        {!compact && (
          <p className={cn('text-muted-foreground border-t border-border', s.footnote)}>
            Based on this dept&apos;s 2007–2021 weekly distribution
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('glass-card rounded-xl', s.container)}>
      <h3 className={cn('text-foreground', s.title)}>Risk Level</h3>
      <p className={cn('text-muted-foreground', s.subtitle)}>
        {loading ? 'Loading…' : 'Per-dept thresholds'}
      </p>
      <div className={cn('flex flex-col', s.rowGap)}>
        {RISK_COLORS.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn('rounded-full flex-shrink-0', s.dot)}
              style={{ backgroundColor: color }}
            />
            <span className={cn('text-foreground', s.label)}>{label}</span>
          </div>
        ))}
      </div>
      {!compact && (
        <p className={cn('text-muted-foreground border-t border-border leading-relaxed', s.footnote)}>
          Each dept has its own thresholds based on historical case percentiles
          (p50 / p80 / p95). Click a dept to see its specific cutoffs.
        </p>
      )}
    </div>
  );
}

function formatNum(n: number): string {
  if (n < 10) return n.toFixed(1).replace(/\.0$/, '');
  if (n < 100) return Math.round(n).toString();
  return Math.round(n).toLocaleString();
}