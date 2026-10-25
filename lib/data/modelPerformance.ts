import type { ModelPerformanceData } from '@/lib/types';

// Static evaluation metrics from the held-out test set (2022-2023).
// Source: sarima_metrics.json, sarimax_metrics.json, neural_network_metrics.json,
//         linear_regression_metrics.json, random_forest_metrics.json, xgboost_metrics.json
// These are version-controlled here rather than stored in the DB because they represent
// a one-time evaluation, not a live measurement.

export const MODEL_PERFORMANCE: ModelPerformanceData = {
  testPeriod: '2022–2023',
  // SARIMAX is the production model despite SARIMA having marginally lower
  // RMSE (25.17 vs 25.28, a 0.46% gap). The deciding factor was interpretability:
  // SARIMA cannot attribute the forecast to climate variables, SARIMAX can.
  bestModel: 'SARIMAX',
  weightedRmse: 25.28,
  averageR2: 0.907,
  departmentsCovered: 32,

  // Final ranking by weighted RMSE (weights 4:3:2:1 for t+1..t+4).
  // RMSE/R²/MAE shown are AVERAGES across the four horizons.
  models: [
    { rank: 1, model: 'SARIMA', strategy: 'Native', rmse: 25.17, r2: 0.908, mae: 13.63 },
    { rank: 2, model: 'SARIMAX', strategy: 'Native', rmse: 25.28, r2: 0.907, mae: 13.70 },
    { rank: 3, model: 'NeuralNetwork', strategy: 'Direct', rmse: 26.76, r2: 0.914, mae: 12.63 },
    { rank: 4, model: 'ElasticNet', strategy: 'Direct', rmse: 27.54, r2: 0.900, mae: 14.91 },
    { rank: 5, model: 'RandomForest', strategy: 'Direct', rmse: 31.37, r2: 0.866, mae: 14.68 },
    { rank: 6, model: 'XGBoost', strategy: 'Direct', rmse: 33.83, r2: 0.847, mae: 14.84 },
  ],

  // RMSE per horizon — exact values from the JSON test metrics.
  rmseByHorizon: [
    { horizon: 't+1', SARIMA: 20.52, SARIMAX: 20.59, NeuralNetwork: 24.50, ElasticNet: 22.20, RandomForest: 24.00, XGBoost: 26.13 },
    { horizon: 't+2', SARIMA: 25.17, SARIMAX: 25.29, NeuralNetwork: 25.37, ElasticNet: 27.41, RandomForest: 31.60, XGBoost: 34.45 },
    { horizon: 't+3', SARIMA: 29.97, SARIMAX: 30.12, NeuralNetwork: 30.39, ElasticNet: 32.89, RandomForest: 38.72, XGBoost: 41.66 },
    { horizon: 't+4', SARIMA: 34.14, SARIMAX: 34.39, NeuralNetwork: 32.73, ElasticNet: 38.61, RandomForest: 45.44, XGBoost: 47.12 },
  ],
};
