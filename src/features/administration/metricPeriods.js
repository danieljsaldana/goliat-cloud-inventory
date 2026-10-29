export const METRIC_PERIODS = [1, 6, 12, 24, 48, 168];

export function validateMetricPeriod(hours = 24) {
  if (!METRIC_PERIODS.includes(hours)) throw new TypeError('invalid_metric_period');
  return hours;
}
