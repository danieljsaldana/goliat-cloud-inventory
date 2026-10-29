export function serviceChartData(metrics, divisor = 1) {
  const points = new Map();
  for (const metric of metrics) {
    for (const { time, value } of metric.data || []) {
      if (!points.has(time)) points.set(time, { time });
      points.get(time)[metric.id] = Number.isFinite(value) ? value / divisor : null;
    }
  }
  return [...points.values()]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((point) => ({
      ...Object.fromEntries(metrics.map(({ id }) => [id, null])),
      ...point,
    }));
}
