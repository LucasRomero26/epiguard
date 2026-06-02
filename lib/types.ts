// Types aligned with the backend (Supabase Edge Functions + HF Space) snake_case convention.

export type RiskLevel = 'low' | 'medium' | 'high' | 'very-high';
export type ForecastHorizon = 1 | 2 | 3 | 4;
export type TrendDirection = 'up' | 'down';

// Static lookup
export interface Department {
  code: number;
  name: string;
  population: number;
  geoIndex: number;
}

// Backend response shapes

/** A single weekly forecast (one of 4 horizons). */
export interface WeeklyForecast {
  horizon: ForecastHorizon;
  cases: number;
  trend: TrendDirection;
}

/**
 * Estimated influence of each climate variable on the forecast.
 * Signed values: positive = pushes cases up; negative = pulls them down.
 * Field names match exactly what the HF Space returns.
 */
export interface ClimateInfluence {
  temperature: number;
  precipitation: number;
  humidity: number;
  oni: number;
  oni_lag4: number;
}

/**
 * Shape returned by:
 *   - GET  /rest/v1/predictions_continuous  (Map view daily snapshot)
 *   - POST /functions/v1/on-demand-predict  (Predictions view per dept)
 *
 * Note: predictions_continuous stores week1..week4 as columns; we'll
 * normalize to weekly_forecasts in the API layer for a unified shape.
 */
export interface PredictionResponse {
  dept_code: number;
  weekly_forecasts: WeeklyForecast[];
  climate_influence: ClimateInfluence;
  risk_level: RiskLevel;
  model_order?: string;
  inference_ms?: number;
}

/** A row of the `predictions_continuous` table (raw shape from Supabase REST). */
export interface PredictionContinuousRow {
  dept_code: number;
  prediction_date: string;
  week1_cases: number;
  week2_cases: number;
  week3_cases: number;
  week4_cases: number;
  risk_level: RiskLevel;
  climate_influence: ClimateInfluence;
  model_order: string | null;
  inference_ms: number | null;
  updated_at: string;
}

/** A row of the `departments` table. */
export interface DepartmentRow {
  code: number;
  name: string;
  population: number | null;
  centroid_lat: number;
  centroid_lon: number;
  is_low_coverage: boolean;
  risk_p50: number;
  risk_p80: number;
  risk_p95: number;
}

// On-demand prediction types

/** What the frontend sends to the Edge Function. */
export interface OnDemandRequest {
  dept_codes: number[];
  filename?: string;
  historical_data: HistoricalRow[];
}

/** A single row of the user's uploaded file (only what the backend needs). */
export interface HistoricalRow {
  dept_code: number;
  week_iso: string;     // 'YYYY-WNN', e.g. '2024-W40'
  cases: number;
}

/** What the Edge Function returns. */
export interface OnDemandResponse {
  run_id: string;
  status: 'success' | 'error' | 'partial';
  results: Record<number, PredictionResponse | { error: string }>;
  failures: { dept_code: number; reason: string }[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Risk summary (used by the map for choropleth coloring)

/** Lightweight risk record — derived from PredictionResponse, used by the map. */
export interface RiskSummary {
  dept_code: number;
  risk_level: RiskLevel;
  predicted_cases: number;     // max of the 4 weekly forecasts
}

// Analytics types (static model performance evaluation)
export interface ModelMetrics {
  rank: number;
  model: string;
  strategy: string;
  rmse: number;
  r2: number;
  mae: number;
}

export interface ScatterPoint {
  actual: number;
  predicted: number;
  department: string;
  deptCode: number;
}

export interface RmseHorizonGroup {
  horizon: string;
  SARIMA: number;
  SARIMAX: number;
  NeuralNetwork: number;
  ElasticNet: number;
  RandomForest: number;
  XGBoost: number;
}

export interface TimeSeriesPoint {
  week: string;
  actual: number;
  predicted: number;
}

export interface ModelPerformanceData {
  models: ModelMetrics[];
  testPeriod: string;
  bestModel: string;
  weightedRmse: number;
  averageR2: number;
  departmentsCovered: number;
  scatterData: ScatterPoint[];
  rmseByHorizon: RmseHorizonGroup[];
  timeSeriesData: Record<number, TimeSeriesPoint[]>;
}