import { validateMetricPeriod } from '../../src/features/administration/metricPeriods.js';

const services = {
  database: {
    setting: 'AZURE_POSTGRES_RESOURCE_ID',
    resourceType: 'Microsoft.DBforPostgreSQL/flexibleServers',
    metrics: [
      { id: 'cpu', name: 'cpu_percent', unit: 'percent', aggregation: 'Average' },
      { id: 'memory', name: 'memory_percent', unit: 'percent', aggregation: 'Average' },
      { id: 'connections', name: 'active_connections', unit: 'count', aggregation: 'Average' },
      { id: 'disk', name: 'storage_used', unit: 'bytes', aggregation: 'Average' },
    ],
  },
  storage: {
    setting: 'AZURE_STORAGE_RESOURCE_ID',
    resourceType: 'Microsoft.Storage/storageAccounts',
    suffix: '/blobServices/default',
    metrics: [
      { id: 'transactions', name: 'Transactions', unit: 'count', aggregation: 'Total' },
      { id: 'ingress', name: 'Ingress', unit: 'bytes', aggregation: 'Total' },
      { id: 'egress', name: 'Egress', unit: 'bytes', aggregation: 'Total' },
      { id: 'latency', name: 'SuccessServerLatency', unit: 'milliseconds', aggregation: 'Average' },
    ],
  },
};
const resourcePattern =
  /^\/subscriptions\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/resourceGroups\/[\w.-]+\/providers\/(Microsoft\.DBforPostgreSQL\/flexibleServers|Microsoft\.Storage\/storageAccounts)\/[\w-]+$/i;

function unavailable(definition, status) {
  return {
    id: definition.id,
    unit: definition.unit,
    aggregation: definition.aggregation,
    status,
    available: false,
    value: null,
    data: [],
  };
}

function measurement(definition, result, start, hours) {
  const metric = result.value?.find(
    (entry) => entry.name?.value?.toLowerCase() === definition.name.toLowerCase(),
  );
  if (metric?.errorCode && metric.errorCode !== 'Success')
    return unavailable(definition, 'unavailable');
  const series = metric?.timeseries || [];
  // Without a dimension filter Azure returns the aggregate series. Averaging separate
  // dimension averages would be incorrect without the sample counts.
  if (series.length > 1) return unavailable(definition, 'unavailable');
  const points = new Map();
  for (const point of series[0]?.data || []) {
    const time = Date.parse(point.timeStamp);
    const value = point[definition.aggregation.toLowerCase()];
    if (Number.isFinite(time) && Number.isFinite(value) && value >= 0) {
      points.set(time, value);
    }
  }
  const data = Array.from({ length: hours }, (_, index) => {
    const time = start.getTime() + index * 3600000;
    return { time: new Date(time).toISOString(), value: points.get(time) ?? null };
  });
  const values = data.map(({ value }) => value).filter(Number.isFinite);
  if (!values.length) return unavailable(definition, 'empty');
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    ...unavailable(definition, 'ready'),
    available: true,
    value: definition.aggregation === 'Total' ? total : total / values.length,
    data,
  };
}

export async function dataServiceMetrics({
  env = process.env,
  credential,
  request = fetch,
  signal,
  end = new Date(),
  hours = 24,
} = {}) {
  validateMetricPeriod(hours);
  // Complete UTC hours give comparable averages and totals across all services.
  const until = new Date(Math.floor(end.getTime() / 3600000) * 3600000);
  const start = new Date(until.getTime() - hours * 3600000);
  const results = await Promise.all(
    Object.entries(services).map(async ([id, service]) => {
      const resourceId = env[service.setting]?.trim();
      const match = resourcePattern.exec(resourceId || '');
      if (!match || match[1].toLowerCase() !== service.resourceType.toLowerCase()) {
        return [
          id,
          {
            configured: false,
            metrics: service.metrics.map((definition) => unavailable(definition, 'not-configured')),
          },
        ];
      }
      const namespace = service.suffix
        ? `${service.resourceType}/blobServices`
        : service.resourceType;
      const aggregations = [...new Set(service.metrics.map(({ aggregation }) => aggregation))];
      const groups = await Promise.all(
        aggregations.map(async (aggregation) => {
          const definitions = service.metrics.filter(
            (definition) => definition.aggregation === aggregation,
          );
          try {
            signal?.throwIfAborted();
            const abortSignal = signal
              ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
              : AbortSignal.timeout(15000);
            const token = await credential.getToken('https://management.azure.com/.default', {
              abortSignal,
            });
            const url = new URL(
              `https://management.azure.com${resourceId}${service.suffix || ''}/providers/Microsoft.Insights/metrics`,
            );
            url.search = new URLSearchParams({
              'api-version': '2023-10-01',
              metricnamespace: namespace,
              metricnames: definitions.map(({ name }) => name).join(','),
              aggregation,
              interval: 'PT1H',
              timespan: `${start.toISOString()}/${until.toISOString()}`,
            }).toString();
            const response = await request(url, {
              signal: abortSignal,
              cache: 'no-store',
              redirect: 'error',
              headers: { Authorization: `Bearer ${token.token}` },
            });
            if (!response.ok) {
              const status = response.status === 403 ? 'forbidden' : 'unavailable';
              return definitions.map((definition) => unavailable(definition, status));
            }
            const result = await response.json();
            return definitions.map((definition) => measurement(definition, result, start, hours));
          } catch {
            return definitions.map((definition) => unavailable(definition, 'unavailable'));
          }
        }),
      );
      return [id, { configured: true, metrics: groups.flat() }];
    }),
  );
  return {
    start: start.toISOString(),
    end: until.toISOString(),
    ...Object.fromEntries(results),
  };
}
