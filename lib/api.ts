import { supabase } from '@/lib/supabase';
import type {
  PredictionContinuousRow,
  PredictionResponse,
  RiskSummary,
  HistoricalRow,
  OnDemandResponse,
  WeeklyForecast,
} from '@/lib/types';

/**
 * The DB stores 4 weekly cases as columns; the rest of the app expects an
 * array of WeeklyForecast objects with a trend per row. This converter
 * builds that shape from a continuous-table row.
 */
function rowToWeeklyForecasts(row: PredictionContinuousRow): WeeklyForecast[] {
  const cases = [row.week1_cases, row.week2_cases, row.week3_cases, row.week4_cases];
  return cases.map((c, i) => ({
    horizon: (i + 1) as 1 | 2 | 3 | 4,
    cases: Number(c),
    // Trend is "vs previous horizon"; week 1 has no previous, default 'up'.
    trend: i === 0
      ? 'up'
      : (Number(c) >= Number(cases[i - 1]) ? 'up' : 'down'),
  }));
}

function rowToPrediction(row: PredictionContinuousRow): PredictionResponse {
  return {
    dept_code: row.dept_code,
    weekly_forecasts: rowToWeeklyForecasts(row),
    climate_influence: row.climate_influence,
    risk_level: row.risk_level,
    model_order: row.model_order ?? undefined,
    inference_ms: row.inference_ms ?? undefined,
  };
}

// Map view: read latest prediction snapshot

/**
 * Fetch the latest snapshot for ALL departments from `predictions_continuous`.
 * Used by ColombiaMap to color each polygon by risk_level.
 *
 * Returns a lightweight `RiskSummary[]` instead of full predictions because
 * the map only needs (code, level, max-cases). Reduces parse cost.
 */
export async function fetchAllRisks(): Promise<RiskSummary[]> {
  const { data, error } = await supabase
    .from('predictions_continuous')
    .select('dept_code,risk_level,week1_cases,week2_cases,week3_cases,week4_cases');
  if (error) throw new Error(`fetchAllRisks: ${error.message}`);
  return (data ?? []).map((r) => ({
    dept_code: r.dept_code,
    risk_level: r.risk_level,
    predicted_cases: Math.max(
      Number(r.week1_cases),
      Number(r.week2_cases),
      Number(r.week3_cases),
      Number(r.week4_cases),
    ),
  }));
}

/**
 * Fetch the full prediction for one department from `predictions_continuous`.
 * Used by the sidebar when the user clicks a department on the map.
 */
export async function fetchPredictions(deptCode: number): Promise<PredictionResponse> {
  const { data, error } = await supabase
    .from('predictions_continuous')
    .select('*')
    .eq('dept_code', deptCode)
    .single();
  if (error) throw new Error(`fetchPredictions(${deptCode}): ${error.message}`);
  return rowToPrediction(data as PredictionContinuousRow);
}

// Predictions view: invoke the on-demand Edge Function

export class UploadValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(issues[0] ?? 'Validation failed');
    this.name = 'UploadValidationError';
    this.issues = issues;
  }
}

/**
 * Send pre-parsed/validated rows to the on-demand Edge Function.
 * Caller is expected to run `parseAndValidateFile` first for client-side feedback.
 *
 * Returns `OnDemandResponse` whose `results` map keys departments to either
 * a successful PredictionResponse or an error object. Caller decides how to
 * render mixed outcomes.
 *
 * Cold-start note: the HF Space sleeps after 48h of inactivity. The first
 * request after sleep can take 30-60 seconds. No client-side retry is
 * implemented — the UI shows a warning for this case instead.
 */
export async function submitOnDemandPrediction(params: {
  deptCodes: number[];
  filename: string;
  historicalData: HistoricalRow[];
}): Promise<OnDemandResponse> {
  const { data, error } = await supabase.functions.invoke<OnDemandResponse>(
    'on-demand-predict',
    {
      body: {
        dept_codes: params.deptCodes,
        filename: params.filename,
        historical_data: params.historicalData,
      },
    },
  );

  // Supabase wraps non-2xx responses as `error`; the Edge Function's JSON
  // body (with the human-readable reason) is in `error.context` if present.
  if (error) {
    // Try to extract the body's error message
    let detail: string | undefined;
    try {
      const body = await (error.context as Response | undefined)?.json();
      detail = body?.error;
    } catch { /* ignore */ }
    throw new Error(detail ?? error.message);
  }
  if (!data) {
    throw new Error('on-demand-predict returned an empty response');
  }
  return data;
}