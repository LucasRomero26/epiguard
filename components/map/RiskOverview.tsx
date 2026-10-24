import { getDepartmentByCode } from '@/lib/data/departments';
import { cn } from '@/lib/utils';
import type { RiskLevel, RiskSummary } from '@/lib/types';

const LEVELS: { level: RiskLevel; label: string; color: string }[] = [
  { level: 'very-high', label: 'Very High', color: '#ef4444' },
  { level: 'high', label: 'High', color: '#f97316' },
  { level: 'medium', label: 'Medium', color: '#eab308' },
  { level: 'low', label: 'Low', color: '#22c55e' },
];

const LEVEL_RANK = new Map(LEVELS.map(({ level }, i) => [level, i]));
const LEVEL_COLOR = new Map(LEVELS.map(({ level, color }) => [level, color]));

interface RiskOverviewProps {
  risks: RiskSummary[];
  className?: string;
}

export default function RiskOverview({ risks, className }: RiskOverviewProps) {
  const ranked = [...risks].sort(
    (a, b) =>
      (LEVEL_RANK.get(a.risk_level) ?? LEVELS.length) - (LEVEL_RANK.get(b.risk_level) ?? LEVELS.length) ||
      b.predicted_cases - a.predicted_cases,
  );

  return (
    <section aria-labelledby="risk-overview-heading" className={cn('px-4 py-6 space-y-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="risk-overview-heading" className="text-lg font-semibold text-foreground">
            Current Risk Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Departments ranked by risk level and peak weekly cases forecast for the next 4 weeks.
          </p>
        </div>
        <a
          href="#risk-map"
          className="shrink-0 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950"
        >
          View map
        </a>
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Risk data is currently unavailable.</p>
      ) : (
        <>
          <ul className="grid grid-cols-4 gap-2">
            {LEVELS.map(({ level, label, color }) => (
              <li key={level} className="glass-card rounded-xl p-3">
                <span className="block h-1.5 w-6 rounded-full" style={{ backgroundColor: color }} />
                <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
                  {ranked.filter(r => r.risk_level === level).length}
                </p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </li>
            ))}
          </ul>

          <ol className="glass-card rounded-xl divide-y divide-border">
            {ranked.map((r, i) => (
              <li key={r.dept_code} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: LEVEL_COLOR.get(r.risk_level) ?? '#6b7280' }}
                />
                <span className="flex-1 text-sm text-foreground">
                  {getDepartmentByCode(r.dept_code)?.name ?? `Dept ${r.dept_code}`}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {Math.round(r.predicted_cases).toLocaleString('en-US')}/wk
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
