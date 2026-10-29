export const SERVICE_METRIC_VIEWS = {
  database: [
    { id: 'load', metrics: ['cpu', 'memory'], unit: 'percent', chart: 'line' },
    { id: 'connections', metrics: ['connections'], unit: 'count', chart: 'line' },
    { id: 'disk', metrics: ['disk'], unit: 'bytes', chart: 'line' },
  ],
  storage: [
    { id: 'requests', metrics: ['transactions'], unit: 'count', chart: 'bar' },
    { id: 'traffic', metrics: ['ingress', 'egress'], unit: 'bytes', chart: 'line' },
    { id: 'latency', metrics: ['latency'], unit: 'milliseconds', chart: 'line' },
  ],
};

export const METRIC_BYTE_UNITS = [
  { divisor: 1073741824, label: 'GiB' },
  { divisor: 1048576, label: 'MiB' },
  { divisor: 1024, label: 'KiB' },
  { divisor: 1, label: 'B' },
];
