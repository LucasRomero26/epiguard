'use client';

import { useState, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
  BarChart, Bar, Legend, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { ArrowUpDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODEL_PERFORMANCE } from '@/lib/mocks/modelPerformance';
import { DEPARTMENTS } from '@/lib/data/departments';
import type { ModelMetrics } from '@/lib/types';

type SortKey = keyof Pick<ModelMetrics, 'rank' | 'rmse' | 'r2' | 'mae'>;

// Color palette for the 6 final evaluated models. Order does NOT track rank —
// these are stable identifiers so the same model always uses the same color
// across all charts on this page.
const MODEL_COLORS: Record<string, string> = {
  SARIMA: '#818cf8',  // indigo
  SARIMAX: '#22d3ee',  // cyan — production model
  NeuralNetwork: '#34d399',  // emerald
  ElasticNet: '#a78bfa',  // violet
  RandomForest: '#facc15',  // yellow
  XGBoost: '#f97316',  // orange
};

const FINDINGS = [
  {
    title: 'SARIMAX chosen for interpretability, not raw accuracy',
    body: 'SARIMA marginally outperforms SARIMAX in weighted RMSE (25.17 vs 25.28, a 0.46% gap). SARIMAX was deployed regardless because it attributes each forecast to climate variables (temperature, precipitation, humidity, ONI), which SARIMA cannot do. For a public-health tool, the question "why is this week elevated?" matters more than the last decimal of RMSE.',
  },
  {
    title: 'Time-series models beat tree ensembles on outbreak peaks',
    body: 'SARIMA (R² ≈ 0.91) and SARIMAX (R² ≈ 0.91) outperform Random Forest (0.866) and XGBoost (0.847) because tree-based predictions are bounded by the training range. They cannot extrapolate during outbreak peaks beyond historical maxima — a structural disqualifier for early warning systems.',
  },
  {
    title: 'Recursive ElasticNet diverges catastrophically',
    body: 'Under the iterative (recursive) strategy where t+1 predictions feed back as lag inputs for t+2, ElasticNet collapsed from R² = 0.94 at t+1 to R² = −2,764.74 at t+4. The compounding interaction between log1p targets, linear coefficients, and expm1 inverse exponential transform amplifies any residual error. The Direct Strategy was adopted for all tabular models as a result.',
  },
  {
    title: 'Climate variability is locally distinct',
    body: 'Climate-influence attribution differs across departments: Valle del Cauca\'s forecasts are dominated by temperature, Boyacá responds primarily to ONI (ENSO state), and Chocó shows no single dominant driver. This per-department heterogeneity justified training 32 separate SARIMAX models rather than a single global model.',
  },
];

export default function AnalyticsView() {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedDeptCode, setSelectedDeptCode] = useState<number>(76);

  const sortedModels = useMemo(() => {
    return [...MODEL_PERFORMANCE.models].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      return (a[sortKey] > b[sortKey] ? 1 : -1) * mul;
    });
  }, [sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDir();
    else { setSortKey(key); setSortDir('asc'); }
  };
  const setDir = () => setSortDir(d => d === 'asc' ? 'desc' : 'asc');

  const seriesData = MODEL_PERFORMANCE.timeSeriesData[selectedDeptCode] ?? [];
  const availableDepts = DEPARTMENTS.filter(d => MODEL_PERFORMANCE.timeSeriesData[d.code]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

      <div>
        <h1 className="text-3xl font-bold text-foreground">Model Performance</h1>
        <p className="text-muted-foreground mt-1">
          Final evaluation results on held-out test set ({MODEL_PERFORMANCE.testPeriod})
        </p>
      </div>

      {/* Disclosure: metrics are static, not live */}
      <div className="glass-card rounded-xl px-4 py-3 flex items-start gap-3 border border-cyan-500/30 bg-cyan-500/5">
        <Info size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-foreground/90 leading-relaxed">
          <span className="font-semibold text-cyan-400">Static results.</span>{' '}
          The metrics on this page reflect the final evaluation of the six trained models against
          the held-out test set (2022–2023). They are computed once at the end of training and do
          not change in production. Live forecasts for the current week are shown on the Map view.
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Production Model', value: MODEL_PERFORMANCE.bestModel, sub: 'SARIMAX — chosen for interpretability' },
          { label: 'RMSE (weighted)', value: MODEL_PERFORMANCE.weightedRmse.toFixed(2), sub: 'Production model, all horizons' },
          { label: 'Average R²', value: MODEL_PERFORMANCE.averageR2.toFixed(3), sub: 'Across all departments' },
          { label: 'Departments Covered', value: MODEL_PERFORMANCE.departmentsCovered, sub: 'Excluding Bogotá (COD 11)' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="glass-card rounded-2xl p-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold tabular-nums text-foreground mt-2">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Model Comparison</h2>
          <span className="text-xs text-muted-foreground">RMSE / MAE averaged across 4 horizons</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {([
                  ['rank', 'Rank'],
                  ['model', 'Model'],
                  ['strategy', 'Strategy'],
                  ['rmse', 'RMSE (weighted)'],
                  ['r2', 'R²'],
                  ['mae', 'MAE'],
                ] as [string, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="px-5 py-3 text-left font-medium"
                  >
                    <button
                      onClick={() => ['rank', 'rmse', 'r2', 'mae'].includes(key) ? toggleSort(key as SortKey) : undefined}
                      className={cn(
                        'flex items-center gap-1',
                        ['rank', 'rmse', 'r2', 'mae'].includes(key) ? 'cursor-pointer hover:text-foreground' : '',
                      )}
                    >
                      {label}
                      {['rank', 'rmse', 'r2', 'mae'].includes(key) && <ArrowUpDown size={11} />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedModels.map((m) => {
                const isProduction = m.model === 'SARIMAX';
                return (
                  <tr
                    key={m.model}
                    className={cn(
                      'border-b border-border/50 transition-colors',
                      isProduction
                        ? 'bg-cyan-500/[0.10]'
                        : m.rank === 1
                          ? 'bg-indigo-500/[0.06]'
                          : 'hover:bg-white/[0.03]',
                    )}
                  >
                    <td className="px-5 py-3">
                      <span className={cn(
                        'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                        isProduction ? 'bg-cyan-500 text-white'
                          : m.rank === 1 ? 'bg-indigo-500 text-white'
                            : 'bg-muted text-muted-foreground',
                      )}>
                        {m.rank}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: MODEL_COLORS[m.model] }} />
                        {m.model}
                        {isProduction && (
                          <span className="ml-1 text-[10px] uppercase tracking-wider font-bold text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                            Production
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{m.strategy}</td>
                    <td className="px-5 py-3 tabular-nums font-medium">{m.rmse.toFixed(2)}</td>
                    <td className="px-5 py-3 tabular-nums font-medium">{m.r2.toFixed(3)}</td>
                    <td className="px-5 py-3 tabular-nums">{m.mae.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-border text-[11px] text-muted-foreground/80">
          SARIMA ranks first by RMSE, but SARIMAX was selected for production: the marginal 0.46%
          accuracy gap is outweighed by its ability to attribute forecasts to climate variables —
          a capability SARIMA structurally lacks.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-4">Predictions vs Reality (Test Set, t+1)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                type="number" dataKey="actual" name="Actual"
                label={{ value: 'Actual Cases', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false}
              />
              <YAxis
                type="number" dataKey="predicted" name="Predicted"
                label={{ value: 'Predicted Cases', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: 'rgba(10,14,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [v, '']}
                labelFormatter={() => ''}
              />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 400, y: 400 }]} stroke="#22d3ee" strokeDasharray="5 5" strokeOpacity={0.5} />
              <Scatter
                data={MODEL_PERFORMANCE.scatterData}
                fill="#22d3ee"
                fillOpacity={0.7}
                r={3}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-4">RMSE Degradation by Forecast Horizon</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={MODEL_PERFORMANCE.rmseByHorizon} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="horizon" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(10,14,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {Object.entries(MODEL_COLORS).map(([model, color]) => (
                <Bar key={model} dataKey={model} fill={color} radius={[2, 2, 0, 0]} maxBarSize={18} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Actual vs Predicted Cases (Test Period)</h2>
          <select
            value={selectedDeptCode}
            onChange={e => setSelectedDeptCode(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg bg-background/60 border border-border text-sm text-foreground cursor-pointer"
          >
            {availableDepts.map(d => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={seriesData} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="week" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false}
              interval={Math.floor(seriesData.length / 6)}
            />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,14,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="actual" stroke="#22d3ee" strokeWidth={2} dot={false} name="Actual" />
            <Line type="monotone" dataKey="predicted" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Predicted" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h2 className="font-semibold text-foreground mb-4">Key Findings</h2>
        <div className="grid grid-cols-2 gap-4">
          {FINDINGS.map(({ title, body }, idx) => (
            <div key={title} className="glass-card rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-bold flex items-center justify-center tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h3 className="font-semibold text-sm text-foreground leading-snug">{title}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}