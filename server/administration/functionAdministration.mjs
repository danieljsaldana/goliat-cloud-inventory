import { azureCredential } from '../modules/azure/storage/credential.mjs';
import { functionClient } from '../modules/azure/services/functionClient.mjs';
import { withRefreshLock } from '../refresh/withRefreshLock.mjs';
import { readSchedule, scheduleVersion, validateSchedule } from './schedule.mjs';
import { publishedInventory } from './publishedInventory.mjs';
import { databaseAdministration } from './databaseAdministration.mjs';
import { dataServiceMetrics } from './dataServiceMetrics.mjs';
import { validateMetricPeriod } from '../../src/features/administration/metricPeriods.js';
import { readTags, tagsVersion, validateTags } from './tags.mjs';

const resourcePattern =
  /^\/subscriptions\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/resourceGroups\/[\w.-]+\/providers\/Microsoft\.Web\/sites\/[\w-]+$/i;
const apiVersion = '2024-11-01';
const metrics = [
  { id: 'executions', name: 'OnDemandFunctionExecutionCount', aggregation: 'Total', unit: 'count' },
  { id: 'memory', name: 'MemoryWorkingSet', aggregation: 'Average', unit: 'bytes' },
  { id: 'cpu', name: 'CpuPercentage', aggregation: 'Average', unit: 'percent' },
];
const credentials = new Map();

export function functionAdministration({
  env = process.env,
  credential,
  request = fetch,
  operations,
  lock = withRefreshLock,
  now = () => new Date(),
  publication = publishedInventory,
  database = databaseAdministration,
  serviceMetrics = dataServiceMetrics,
} = {}) {
  const resourceId = env.AZURE_FUNCTION_RESOURCE_ID;
  if (!resourcePattern.test(resourceId || ''))
    throw Object.assign(new Error('administration_unconfigured'), { status: 503 });
  if (!credential) {
    const key = JSON.stringify([
      env.AZURE_AUTH_MODE,
      env.AZURE_TENANT_ID,
      env.AZURE_CLIENT_ID,
      env.AZURE_CLIENT_SECRET,
    ]);
    if (!credentials.has(key)) credentials.set(key, azureCredential(env));
    credential = credentials.get(key);
  }
  async function arm(path = '', { method = 'GET', body, query, signal } = {}) {
    const abortSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000);
    const token = await credential.getToken('https://management.azure.com/.default', {
      abortSignal,
    });
    const url = new URL(`https://management.azure.com${resourceId}${path}`);
    url.search = new URLSearchParams(query || { 'api-version': apiVersion }).toString();
    const response = await request(url, {
      method,
      signal: abortSignal,
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${token.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw Object.assign(new Error('azure_management_unavailable'), {
        code: `ARM_HTTP_${response.status}`,
      });
    return response.json();
  }
  const settings = (signal) => arm('/config/appsettings/list', { method: 'POST', signal });
  async function updateSettings(input, signal, { version, read, change, conflict }) {
    return lock(
      'function-schedule',
      async ({ signal: lockedSignal }) => {
        const operation = await (operations || functionClient({ env })).current(lockedSignal);
        if (['queued', 'running', 'retrying'].includes(operation?.status))
          throw Object.assign(new Error('generation_running'), { status: 409 });
        const config = await settings(lockedSignal);
        if (version(config.properties) !== input.version)
          throw Object.assign(new Error(conflict), { status: 409 });
        const properties = { ...config.properties, ...change };
        await arm('/config/appsettings', {
          method: 'PUT',
          body: { properties },
          signal: lockedSignal,
        });
        const confirmed = await settings(lockedSignal);
        if (version(confirmed.properties) !== version(properties))
          throw new Error('settings_not_confirmed');
        return read(confirmed.properties);
      },
      { signal },
    );
  }
  async function metric(definition, signal, end, hours) {
    const start = new Date(end.getTime() - hours * 3600000);
    const result = await arm('/providers/Microsoft.Insights/metrics', {
      signal,
      query: {
        'api-version': '2023-10-01',
        metricnames: definition.name,
        aggregation: definition.aggregation,
        interval: 'PT1H',
        timespan: `${start.toISOString()}/${end.toISOString()}`,
      },
    });
    const series = result.value?.[0]?.timeseries || [];
    const points = new Map();
    for (const line of series)
      for (const point of line.data || []) {
        const value = point[definition.aggregation.toLowerCase()];
        if (Number.isFinite(value)) {
          const values = points.get(point.timeStamp) || [];
          values.push(value);
          points.set(point.timeStamp, values);
        }
      }
    const data = [...points]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, values]) => ({
        time,
        value:
          definition.aggregation === 'Total'
            ? values.reduce((a, b) => a + b, 0)
            : values.reduce((a, b) => a + b, 0) / values.length,
      }));
    const total = data.reduce((sum, point) => sum + point.value, 0);
    const summaryDivisor = definition.aggregation === 'Total' ? 1 : data.length;
    return {
      id: definition.id,
      unit: definition.unit,
      available: data.length > 0,
      data,
      value: data.length ? total / summaryDivisor : null,
    };
  }
  return {
    async read(signal, hours = 24) {
      validateMetricPeriod(hours);
      const end = now();
      const metricsEnd = new Date(Math.floor(end.getTime() / 3600000) * 3600000);
      const [site, config, operation, published, postgres, services, ...measurements] =
        await Promise.allSettled([
          arm('', { signal }),
          settings(signal),
          (operations || functionClient({ env })).current(signal),
          publication({ env, signal }),
          database({ env, signal }),
          serviceMetrics({ env, credential, request, signal, end: metricsEnd, hours }),
          ...metrics.map((definition) => metric(definition, signal, metricsEnd, hours)),
        ]);
      if (site.status === 'rejected') throw site.reason;
      const properties = site.value.properties || {};
      const scale = properties.functionAppConfig?.scaleAndConcurrency;
      const current = operation.status === 'fulfilled' ? operation.value : null;
      return {
        checkedAt: end.toISOString(),
        windowHours: hours,
        function: {
          name: site.value.name,
          location: site.value.location,
          state: properties.state,
          hostName: properties.defaultHostName,
          resourceId,
          runtime: properties.functionAppConfig?.runtime,
          memoryMB: scale?.instanceMemoryMB,
          maximumInstances: scale?.maximumInstanceCount,
          portalUrl: `https://portal.azure.com/#@${encodeURIComponent(env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.split('/')[3] || '')}/resource${resourceId}/overview`,
        },
        schedule: config.status === 'fulfilled' ? readSchedule(config.value.properties) : null,
        tags: config.status === 'fulfilled' ? readTags(config.value.properties) : null,
        operationAvailable: operation.status === 'fulfilled',
        publication: published.status === 'fulfilled' ? published.value : null,
        database: postgres.status === 'fulfilled' ? postgres.value : null,
        dataServices: services.status === 'fulfilled' ? services.value : null,
        operation: current
          ? Object.fromEntries(
              [
                'operationId',
                'status',
                'requestedAt',
                'startedAt',
                'completedAt',
                'generatedAt',
                'etag',
              ]
                .filter((key) => typeof current[key] === 'string')
                .map((key) => [key, current[key]]),
            )
          : null,
        metrics: measurements.map((result, i) =>
          result.status === 'fulfilled'
            ? result.value
            : { id: metrics[i].id, unit: metrics[i].unit, available: false, value: null, data: [] },
        ),
      };
    },
    async updateSchedule(input, signal) {
      const change = validateSchedule(input);
      return updateSettings(input, signal, {
        version: scheduleVersion,
        read: readSchedule,
        conflict: 'schedule_changed',
        change: {
          INVENTORY_SCHEDULE: change.cron,
          'AzureWebJobs.inventoryTimer.Disabled': String(!change.enabled),
        },
      });
    },
    async updateTags(input, signal) {
      const keys = validateTags(input);
      return updateSettings(input, signal, {
        version: tagsVersion,
        read: readTags,
        conflict: 'tags_changed',
        change: { INVENTORY_TAG_KEYS: keys.join(',') },
      });
    },
  };
}
