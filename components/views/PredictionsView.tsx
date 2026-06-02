'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, ChevronsUpDown, Upload, X, AlertCircle, AlertTriangle, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DEPARTMENTS, getDepartmentByCode } from '@/lib/data/departments';
import { submitOnDemandPrediction, fetchPredictions } from '@/lib/api';
import { generateReport } from '@/lib/pdfReport';
import RiskLegend from '@/components/map/RiskLegend';
import { parseAndValidateFile, filterRowsForSelection, type ParseSuccess } from '@/lib/parseFile';
import type { PredictionResponse, RiskLevel } from '@/lib/types';
import DepartmentSidebar from '@/components/map/DepartmentSidebar';

const ColombiaMap = dynamic(() => import('@/components/map/ColombiaMap'), { ssr: false });

const STEPS = ['Select Departments', 'Upload Data', 'Process'] as const;

// What the user sees as the expected schema. The backend infers climate
// from NASA POWER & NOAA ONI itself, so the hospital only supplies cases.
const SCHEMA_COLUMNS = [
  { name: 'dept_code', desc: 'DANE department code (integer, e.g. 76)' },
  { name: 'week_iso', desc: 'ISO 8601 week, "YYYY-WNN" (e.g. 2024-W40)' },
  { name: 'cases', desc: 'Weekly case count, non-negative number' },
];

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low', medium: 'Medium', high: 'High', 'very-high': 'Very High',
};

// Progress stage labels shown during backend inference.
// Timing is approximate: NASA climate fetch ~10s, HF inference ~1-3s per dept.
const STAGES = [
  'Validating with backend...',
  'Fetching climate data (NASA POWER)...',
  'Running predictions on each department...',
  'Compiling results...',
] as const;

// Order risk levels from least to most severe so we can pick a "max" for the
// summary panel (otherwise we'd report whichever was most frequent, which
// doesn't reflect the actual epidemiological signal).
const RISK_RANK: Record<RiskLevel, number> = {
  low: 0, medium: 1, high: 2, 'very-high': 3,
};

type ProcessState = 'idle' | 'parsing' | 'loading' | 'error' | 'success';

export default function PredictionsView() {
  const [step, setStep] = useState(0);
  const [selectedCodes, setSelectedCodes] = useState<Set<number>>(new Set());
  const [comboOpen, setComboOpen] = useState(false);
  const [comboSearch, setComboSearch] = useState('');
  // Ref to the dropdown container; used for click-outside detection.
  const comboRef = useRef<HTMLDivElement>(null);

  // File + parsed result
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<ParseSuccess | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  // Processing
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState<PredictionResponse[]>([]);
  const [showSchema, setShowSchema] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Sidebar within results map
  const [mapSelectedCode, setMapSelectedCode] = useState<number | null>(null);
  const [mapPredictions, setMapPredictions] = useState<PredictionResponse | null>(null);
  // Tracks PDF generation so the button can show a busy state
  const [generatingReport, setGeneratingReport] = useState(false);

  // Close the department dropdown on click outside or Escape press.
  // Standard select-style UX: the user marks departments, then clicks
  // anywhere else (or hits Esc) and the dropdown collapses on its own.
  useEffect(() => {
    if (!comboOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setComboOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [comboOpen]);

  const toggleCode = (code: number) => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) { next.delete(code); } else { next.add(code); }
      return next;
    });
  };

  // Reset all file-related state (used when user removes a file or re-uploads)
  const resetFileState = () => {
    setFile(null);
    setParseResult(null);
    setParseErrors([]);
    setParseWarnings([]);
  };

  /**
   * Called when the user drops or selects a file. Performs format checks
   * and immediately runs client-side validation so errors show without
   * waiting for the backend.
   */
  const handleFile = useCallback(async (f: File | null) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    const validExts = ['csv', 'json', 'xlsx', 'xls'];
    if (!validExts.includes(ext ?? '')) {
      toast.error('Invalid file type. Accepted: CSV, JSON, XLSX');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File exceeds 10 MB limit');
      return;
    }

    setFile(f);
    setProcessState('parsing');
    const result = await parseAndValidateFile(f);
    setProcessState('idle');

    if (!result.ok) {
      setParseResult(null);
      setParseErrors(result.errors);
      setParseWarnings(result.warnings);
      toast.error(`File has ${result.errors.length} validation issue(s)`);
      return;
    }
    setParseResult(result);
    setParseErrors([]);
    setParseWarnings(result.warnings);
    if (result.warnings.length > 0) {
      toast.warning(`File parsed with ${result.warnings.length} warning(s)`);
    } else {
      toast.success(`File parsed: ${result.fileSummary.totalRows} rows across ${result.fileSummary.deptsFound.length} dept(s)`);
    }
  }, []);

  const runPredictions = async () => {
    if (!file || !parseResult || selectedCodes.size === 0) return;

    // Filter parsed rows down to just the selected departments
    const { rows: rowsToSubmit, insufficient } = filterRowsForSelection(
      parseResult,
      Array.from(selectedCodes),
    );
    if (insufficient.length > 0) {
      const names = insufficient
        .map((c) => getDepartmentByCode(c)?.name ?? `code ${c}`)
        .join(', ');
      toast.error(`Not enough data for: ${names}. Need at least 4 weeks per department.`);
      return;
    }

    setProcessState('loading');
    setProgress(0);
    setErrorMsg('');

    // Animate progress through stages. Real backend can take 30-60s on
    // cold start; this loop runs more slowly than the mock did.
    let stageIdx = 0;
    setProgressStage(STAGES[0]);
    const interval = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, STAGES.length - 1);
      setProgressStage(STAGES[stageIdx]);
      setProgress((prev) => Math.min(prev + 8 + Math.random() * 4, 92));
    }, 4000);

    try {
      const response = await submitOnDemandPrediction({
        deptCodes: Array.from(selectedCodes),
        filename: file.name,
        historicalData: rowsToSubmit,
      });

      clearInterval(interval);
      setProgress(100);

      // Convert the response.results map into an array of PredictionResponse
      // for each successful dept (skipping ones where the backend errored).
      const successPreds: PredictionResponse[] = [];
      const failedDepts: { code: number; reason: string }[] = [];
      for (const [codeStr, item] of Object.entries(response.results)) {
        const code = Number(codeStr);
        if (item && typeof item === 'object' && 'error' in item) {
          failedDepts.push({ code, reason: String(item.error) });
        } else {
          successPreds.push(item as PredictionResponse);
        }
      }

      if (failedDepts.length > 0) {
        const names = failedDepts
          .map((f) => getDepartmentByCode(f.code)?.name ?? `code ${f.code}`)
          .join(', ');
        toast.warning(`Predictions failed for: ${names}`);
      }
      if (successPreds.length === 0) {
        throw new Error('All departments failed. See backend logs.');
      }

      setTimeout(() => {
        setResults(successPreds);
        setProcessState('success');
      }, 300);
    } catch (err) {
      clearInterval(interval);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMsg(msg);
      setProcessState('error');
      setProgress(0);
    }
  };

  /**
   * Pick the most severe risk level across all returned predictions.
   * "Average" was misleading because risks aren't ordinal — peak risk is
   * what an epidemiologist actually cares about.
   */
  const peakRiskLabel = (): string => {
    if (results.length === 0) return 'N/A';
    let peak: RiskLevel = 'low';
    for (const r of results) {
      if (RISK_RANK[r.risk_level] > RISK_RANK[peak]) peak = r.risk_level;
    }
    return RISK_LABELS[peak];
  };

  const filteredDepts = DEPARTMENTS.filter((d) =>
    d.name.toLowerCase().includes(comboSearch.toLowerCase()),
  );

  const handleGenerateReport = async () => {
    if (results.length === 0) return;
    setGeneratingReport(true);
    try {
      await generateReport(results, {
        source: 'predictions',
        originalFilename: file?.name,
      });
      toast.success('Report downloaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate report';
      toast.error(`Report failed: ${msg}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleMapClick = async (code: number) => {
    if (mapSelectedCode === code) { setMapSelectedCode(null); setMapPredictions(null); return; }
    setMapSelectedCode(code);

    // Prefer the on-demand result we just computed (fresher than DB)
    const fromResults = results.find((r) => r.dept_code === code);
    if (fromResults) {
      setMapPredictions(fromResults);
      return;
    }

    // Fallback to DB if user clicks a non-selected dept on the map
    try {
      const data = await fetchPredictions(code);
      setMapPredictions(data);
    } catch {
      setMapPredictions(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      <div className={cn(
        'flex flex-col border-r border-border transition-all duration-500',
        processState === 'success' ? 'w-[40%]' : 'w-1/2',
      )}>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  'flex items-center gap-1.5 text-sm font-medium transition-colors',
                  i <= step ? 'text-cyan-500' : 'text-muted-foreground',
                )}>
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                    i < step ? 'bg-cyan-500 text-white' :
                      i === step ? 'border-2 border-cyan-500 text-cyan-500' :
                        'border border-muted-foreground text-muted-foreground',
                  )}>
                    {i < step ? <Check size={10} /> : i + 1}
                  </div>
                  {s}
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight size={14} className="mx-2 text-muted-foreground/50" />
                )}
              </div>
            ))}
          </div>

          <div className={cn('space-y-3 transition-opacity', step < 0 ? 'opacity-50 pointer-events-none' : '')}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">1. Select Departments</h3>
              <span className="text-xs text-muted-foreground">
                {selectedCodes.size} of 32 selected
              </span>
            </div>

            <div className="relative" ref={comboRef}>
              <button
                onClick={() => setComboOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-background/50 text-sm cursor-pointer hover:bg-white/5 transition-colors"
              >
                <span className={selectedCodes.size === 0 ? 'text-muted-foreground' : 'text-foreground'}>
                  {selectedCodes.size === 0
                    ? 'Select departments…'
                    : `${selectedCodes.size} department${selectedCodes.size !== 1 ? 's' : ''} selected`}
                </span>
                <ChevronsUpDown size={14} className="text-muted-foreground" />
              </button>

              {comboOpen && (
                <div className="absolute z-50 w-full mt-1 glass-card rounded-xl border border-border overflow-hidden shadow-2xl">
                  <div className="p-2 border-b border-border">
                    <input
                      autoFocus
                      value={comboSearch}
                      onChange={(e) => setComboSearch(e.target.value)}
                      placeholder="Search departments…"
                      className="w-full px-3 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="flex gap-2 p-2 border-b border-border">
                    <button
                      onClick={() => setSelectedCodes(new Set(DEPARTMENTS.map((d) => d.code)))}
                      className="text-xs text-cyan-500 hover:underline cursor-pointer"
                    >Select all</button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      onClick={() => setSelectedCodes(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >Clear all</button>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredDepts.map((dept) => (
                      <div
                        key={dept.code}
                        onClick={() => toggleCode(dept.code)}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 cursor-pointer text-sm transition-colors"
                      >
                        <div className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center',
                          selectedCodes.has(dept.code) ? 'bg-cyan-500 border-cyan-500' : 'border-border',
                        )}>
                          {selectedCodes.has(dept.code) && <Check size={10} className="text-white" />}
                        </div>
                        <span>{dept.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground font-mono">
                          {String(dept.code).padStart(2, '0')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedCodes.size > 0 && step === 0 && (
              <button
                onClick={() => setStep(1)}
                className="w-full py-2 rounded-lg bg-cyan-500/10 text-cyan-500 text-sm font-medium hover:bg-cyan-500/20 transition-colors cursor-pointer border border-cyan-500/30"
              >
                Continue to upload →
              </button>
            )}
          </div>

          {step >= 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">2. Upload Data</h3>
                <button
                  className="text-xs text-cyan-500 hover:underline cursor-pointer"
                  onClick={() => setShowSchema((v) => !v)}
                >
                  Show expected schema
                </button>
              </div>

              {showSchema && (
                <div className="glass-card rounded-xl p-4 text-xs space-y-2">
                  <p className="text-muted-foreground font-medium">
                    Required columns (climate is auto-fetched by the backend):
                  </p>
                  {SCHEMA_COLUMNS.map((col) => (
                    <div key={col.name} className="flex items-baseline gap-2">
                      <span className="text-cyan-400 font-mono font-semibold">{col.name}</span>
                      <span className="text-muted-foreground">— {col.desc}</span>
                    </div>
                  ))}
                  <p className="text-muted-foreground/80 text-[11px] mt-2 pt-2 border-t border-border">
                    At least 4 rows per department. Max 1000 rows / 10 MB.
                  </p>
                </div>
              )}

              {!file ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                  onClick={() => fileInput.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                    dragOver ? 'border-cyan-500 bg-cyan-500/10' : 'border-border hover:border-cyan-500/50 hover:bg-white/5',
                  )}
                >
                  <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop file here or <span className="text-cyan-500">browse</span></p>
                  <p className="text-xs text-muted-foreground mt-1">CSV, JSON, XLSX · Max 10 MB</p>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".csv,.json,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 glass-card rounded-xl border border-cyan-500/30">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                      <Upload size={14} className="text-cyan-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                        {parseResult && (
                          <> · {parseResult.fileSummary.totalRows} rows ·{' '}
                            {parseResult.fileSummary.deptsFound.length} dept{parseResult.fileSummary.deptsFound.length !== 1 ? 's' : ''}</>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={resetFileState}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {parseErrors.length > 0 && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1">
                      <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
                        <AlertCircle size={13} />
                        Validation failed
                      </div>
                      <ul className="text-xs text-red-400/90 space-y-0.5 list-disc pl-5">
                        {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Non-blocking validation warnings */}
                  {parseResult && parseWarnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                        <AlertTriangle size={13} />
                        Warnings ({parseWarnings.length})
                      </div>
                      <ul className="text-xs text-amber-400/90 space-y-0.5 list-disc pl-5">
                        {parseWarnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                        {parseWarnings.length > 5 && (
                          <li className="text-amber-400/60">…and {parseWarnings.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {parseResult && step === 1 && (
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-2 rounded-lg bg-cyan-500/10 text-cyan-500 text-sm font-medium hover:bg-cyan-500/20 transition-colors cursor-pointer border border-cyan-500/30"
                >
                  Continue to process →
                </button>
              )}
            </div>
          )}

          {step >= 2 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">3. Process</h3>

              {processState === 'idle' && (
                <button
                  onClick={runPredictions}
                  disabled={selectedCodes.size === 0 || !parseResult}
                  className={cn(
                    'w-full py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer',
                    selectedCodes.size > 0 && parseResult
                      ? 'bg-cyan-500 text-white hover:bg-cyan-400 shadow-lg shadow-cyan-500/25'
                      : 'bg-muted text-muted-foreground cursor-not-allowed',
                  )}
                >
                  Run Predictions
                </button>
              )}

              {processState === 'loading' && (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{progressStage}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground/80">
                    First request after long inactivity may take up to 60 seconds.
                  </p>
                </div>
              )}

              {processState === 'error' && (
                <>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Backend error</p>
                      <p className="text-xs mt-0.5 text-red-400/80">{errorMsg}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setProcessState('idle'); setErrorMsg(''); setProgress(0); }}
                    className="w-full py-2 rounded-lg text-sm text-cyan-500 hover:bg-cyan-500/10 transition-colors cursor-pointer border border-cyan-500/30"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {processState === 'success' && results.length > 0 && (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex gap-4">
              {[
                { label: 'Departments analyzed', value: results.length },
                { label: 'Predictions generated', value: `${results.length} × 4 = ${results.length * 4}` },
                { label: 'Peak risk level', value: peakRiskLabel() },
              ].map(({ label, value }) => (
                <div key={label} className="glass-card rounded-xl px-4 py-2.5 flex-1">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-base font-bold tabular-nums text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer',
                generatingReport
                  ? 'bg-muted text-muted-foreground cursor-wait'
                  : 'bg-cyan-500 text-white hover:bg-cyan-400 shadow-lg shadow-cyan-500/25',
              )}
            >
              <FileText size={15} />
              {generatingReport ? 'Generating PDF…' : 'Generate Full Report'}
            </button>
          </div>

          <div className="flex-1 relative">
            <ColombiaMap
              onDepartmentClick={handleMapClick}
              selectedCode={mapSelectedCode}
              highlightedCodes={new Set(results.map((r) => r.dept_code))}
              compact
            />

            <div className="absolute top-4 left-4 z-10">
              <RiskLegend selectedDeptCode={mapSelectedCode} compact />
            </div>

            {mapSelectedCode && (
              <div className="absolute right-0 top-0 bottom-0 w-[380px] glass-card border-l border-border overflow-hidden z-10">
                <DepartmentSidebar
                  department={getDepartmentByCode(mapSelectedCode)!}
                  predictions={mapPredictions}
                  onClose={() => { setMapSelectedCode(null); setMapPredictions(null); }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}