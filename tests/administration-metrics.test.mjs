import test from 'node:test';
import assert from 'node:assert/strict';
import { dataServiceMetrics } from '../server/administration/dataServiceMetrics.mjs';
import { functionAdministration } from '../server/administration/functionAdministration.mjs';
import { serviceChartData } from '../src/features/administration/utils/serviceChartData.js';
import { handleAdministration } from '../server/administration/handleAdministration.mjs';
import { METRIC_PERIODS } from '../src/features/administration/metricPeriods.js';

const scope =
  '/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/rg-test/providers/';
const env = {
  AZURE_POSTGRES_RESOURCE_ID: `${scope}Microsoft.DBforPostgreSQL/flexibleServers/pg-test`,
  AZURE_STORAGE_RESOURCE_ID: `${scope}Microsoft.Storage/storageAccounts/sttest`,
};
const end = new Date('2026-10-10T12:37:21Z');
const credential = { getToken: async () => ({ token: 'private-test-token' }) };

test('selected periods reach every Azure query and include only samples in the requested window', async () => {
  for (const hours of METRIC_PERIODS) {
    const calls = [];
    const result = await functionAdministration({
      env: { ...env, AZURE_FUNCTION_RESOURCE_ID: `${scope}Microsoft.Web/sites/func-test` },
      credential,
      now: () => end,
      operations: { current: async () => null },
      publication: async () => null,
      database: async () => null,
      request: async (url) => {
        if (url.pathname.endsWith('/metrics')) {
          calls.push(url);
          const aggregation = url.searchParams.get('aggregation');
          const names = url.searchParams.get('metricnames').split(',');
          const data = response(names, aggregation);
          for (const entry of data.value)
            entry.timeseries[0].data.push({
              timeStamp: '2026-10-10T11:00:00Z',
              [aggregation.toLowerCase()]: 5,
            });
          return Response.json(data);
        }
        if (url.pathname.endsWith('/list')) return Response.json({ properties: {} });
        return Response.json({ name: 'func-test', properties: {} });
      },
    }).read(undefined, hours);
    assert.equal(result.windowHours, hours);
    assert.equal(calls.length, 6);
    const until = '2026-10-10T12:00:00.000Z';
    const start = new Date(Date.parse(until) - hours * 3600000).toISOString();
    for (const url of calls) {
      assert.equal(url.searchParams.get('timespan'), `${start}/${until}`);
      assert.equal(url.searchParams.get('interval'), 'PT1H');
    }
    const cpu = result.dataServices.database.metrics.find(({ id }) => id === 'cpu');
    assert.equal(cpu.data.length, hours);
    assert.equal(cpu.data[0].time, start);
    assert.equal(cpu.value, hours === 1 ? 5 : 8.75);
    assert.equal(
      result.dataServices.storage.metrics.find(({ id }) => id === 'transactions').value,
      hours === 1 ? 5 : 35,
    );
  }
});

test('API defaults to 24 hours and rejects unsupported periods before invoking the client', async () => {
  const calls = [];
  const client = {
    read: async (_signal, hours) => {
      calls.push(hours);
      return { windowHours: hours };
    },
  };
  for (const query of ['', '?hours=6', '?hours=168']) {
    const result = await handleAdministration(
      new Request(`https://web.example/api/admin/function/${query}`),
      { client },
    );
    assert.equal(result.status, 200);
  }
  assert.deepEqual(calls, [24, 6, 168]);
  for (const value of ['0', '-1', '25', '169', '1.5', '', 'NaN', 'Infinity']) {
    const result = await handleAdministration(
      new Request(`https://web.example/api/admin/function/?hours=${value}`),
      { client },
    );
    assert.equal(result.status, 400);
    assert.deepEqual(await result.json(), { error: 'invalid_metric_period' });
  }
  assert.deepEqual(calls, [24, 6, 168]);
  await assert.rejects(dataServiceMetrics({ hours: 100000 }), /invalid_metric_period/);
});

function response(names, aggregation, values = [10, 0, 20]) {
  return {
    value: names.map((name) => ({
      name: { value: name },
      errorCode: 'Success',
      timeseries: [
        {
          data: values.map((value, index) => ({
            timeStamp: `2026-10-10T${String(8 + index).padStart(2, '0')}:00:00Z`,
            [aggregation.toLowerCase()]: value,
          })),
        },
      ],
    })),
  };
}

test('service metrics query only ARM reads, group compatible aggregations and use complete UTC hours', async () => {
  const calls = [];
  const result = await dataServiceMetrics({
    env,
    credential,
    end,
    request: async (url, options) => {
      calls.push({ url, options });
      return Response.json(
        response(
          url.searchParams.get('metricnames').split(',').reverse(),
          url.searchParams.get('aggregation'),
        ),
      );
    },
  });
  assert.equal(calls.length, 3);
  assert.equal(result.start, '2026-10-09T12:00:00.000Z');
  assert.equal(result.end, '2026-10-10T12:00:00.000Z');
  for (const { url, options } of calls) {
    assert.equal(url.origin, 'https://management.azure.com');
    assert.equal(options.method, undefined);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    assert.equal(url.searchParams.get('interval'), 'PT1H');
    assert.equal(url.searchParams.get('timespan'), `${result.start}/${result.end}`);
    if (url.pathname.includes('Microsoft.Storage')) {
      assert.ok(
        url.pathname.includes('/blobServices/default/providers/Microsoft.Insights/metrics'),
      );
      assert.equal(
        url.searchParams.get('metricnamespace'),
        'Microsoft.Storage/storageAccounts/blobServices',
      );
    }
  }
  const cpu = result.database.metrics.find(({ id }) => id === 'cpu');
  assert.equal(cpu.value, 10);
  assert.equal(cpu.data.length, 24);
  assert.equal(cpu.data.find(({ time }) => time === '2026-10-10T09:00:00.000Z').value, 0);
  assert.equal(cpu.data[0].value, null);
  assert.equal(result.storage.metrics.find(({ id }) => id === 'transactions').value, 30);
  assert.equal(result.storage.metrics.find(({ id }) => id === 'latency').value, 10);
  assert.equal(JSON.stringify(result).includes('private-test-token'), false);
});

test('missing samples remain gaps and are excluded from averages instead of becoming zero', async () => {
  const result = await dataServiceMetrics({
    env,
    credential,
    end,
    request: async (url) =>
      Response.json(
        response(
          url.searchParams.get('metricnames').split(','),
          url.searchParams.get('aggregation'),
          [30, null, 50],
        ),
      ),
  });
  const metric = result.database.metrics.find(({ id }) => id === 'cpu');
  assert.equal(metric.value, 40);
  assert.equal(metric.data.find(({ time }) => time === '2026-10-10T09:00:00.000Z').value, null);
  assert.equal(result.storage.metrics.find(({ id }) => id === 'transactions').value, 80);
});

test('missing, invalid or wrong-type resource IDs never invoke credentials or make network requests', async () => {
  const calls = [];
  const request = async () => {
    calls.push('network');
    throw new Error('unexpected request');
  };
  const unavailableCredential = {
    getToken: async () => {
      calls.push('credential');
      throw new Error('unexpected credential');
    },
  };
  for (const configuration of [
    {},
    { AZURE_POSTGRES_RESOURCE_ID: 'https://evil.example' },
    { AZURE_POSTGRES_RESOURCE_ID: env.AZURE_STORAGE_RESOURCE_ID },
    { AZURE_STORAGE_RESOURCE_ID: `${env.AZURE_STORAGE_RESOURCE_ID}?resource=evil` },
    { AZURE_STORAGE_RESOURCE_ID: `${env.AZURE_STORAGE_RESOURCE_ID}/blobServices/default` },
  ]) {
    const result = await dataServiceMetrics({
      env: configuration,
      credential: unavailableCredential,
      request,
      end,
    });
    assert.equal(result.database.configured, false);
    assert.equal(result.storage.configured, false);
    assert.ok(
      result.database.metrics.every(
        ({ status, value, available }) =>
          status === 'not-configured' && value === null && !available,
      ),
    );
  }
  assert.deepEqual(calls, []);
});

test('permissions failures and API errors do not hide independently available services or expose raw errors', async () => {
  const result = await dataServiceMetrics({
    env,
    credential,
    end,
    request: async (url) => {
      if (url.pathname.includes('DBforPostgreSQL'))
        return Response.json({ error: 'private-error' }, { status: 403 });
      if (url.searchParams.get('aggregation') === 'Average') throw new Error('private-error');
      return Response.json(response(url.searchParams.get('metricnames').split(','), 'Total'));
    },
  });
  assert.ok(
    result.database.metrics.every(
      ({ status, available, value }) => status === 'forbidden' && !available && value === null,
    ),
  );
  assert.equal(result.storage.metrics.find(({ id }) => id === 'transactions').available, true);
  assert.equal(result.storage.metrics.find(({ id }) => id === 'latency').status, 'unavailable');
  assert.equal(JSON.stringify(result).includes('private-error'), false);
});

test('empty results, per-metric failures and dimension series are not presented as valid zero measurements', async () => {
  const result = await dataServiceMetrics({
    env,
    credential,
    end,
    request: async (url) => {
      const data = response(
        url.searchParams.get('metricnames').split(','),
        url.searchParams.get('aggregation'),
      );
      for (const entry of data.value) {
        if (entry.name.value === 'cpu_percent') entry.timeseries.push(entry.timeseries[0]);
        if (entry.name.value === 'memory_percent') entry.errorCode = 'InvalidSamplingType';
        if (entry.name.value === 'active_connections') entry.timeseries = [];
        if (entry.name.value === 'Transactions') entry.timeseries[0].data = [];
      }
      return Response.json(data);
    },
  });
  assert.equal(result.database.metrics.find(({ id }) => id === 'cpu').status, 'unavailable');
  assert.equal(result.database.metrics.find(({ id }) => id === 'memory').status, 'unavailable');
  assert.equal(result.database.metrics.find(({ id }) => id === 'connections').status, 'empty');
  assert.equal(result.storage.metrics.find(({ id }) => id === 'transactions').status, 'empty');
  assert.equal(result.database.metrics.find(({ id }) => id === 'disk').available, true);
});

test('charts align series and byte units while preserving missing values and leaving inputs intact', () => {
  const input = [
    {
      id: 'ingress',
      data: [
        { time: '2026-10-10T10:00:00Z', value: null },
        { time: '2026-10-10T09:00:00Z', value: 2048 },
      ],
    },
    { id: 'egress', data: [{ time: '2026-10-10T10:00:00Z', value: 0 }] },
  ];
  const original = structuredClone(input);
  assert.deepEqual(serviceChartData(input, 1024), [
    { time: '2026-10-10T09:00:00Z', ingress: 2, egress: null },
    { time: '2026-10-10T10:00:00Z', ingress: null, egress: 0 },
  ]);
  assert.deepEqual(input, original);
});

test('administration isolates a monitoring outage from database, publication and Function information', async () => {
  const result = await functionAdministration({
    env: { ...env, AZURE_FUNCTION_RESOURCE_ID: `${scope}Microsoft.Web/sites/func-test` },
    credential,
    operations: { current: async () => null },
    publication: async () => ({ bytes: 123 }),
    database: async () => ({ name: 'inventory' }),
    serviceMetrics: async () => {
      throw new Error('private-error');
    },
    request: async (url) => {
      if (url.pathname.endsWith('/metrics')) return Response.json({ value: [] });
      if (url.pathname.endsWith('/list')) return Response.json({ properties: {} });
      return Response.json({ name: 'func-test', properties: {} });
    },
  }).read();
  assert.equal(result.database.name, 'inventory');
  assert.equal(result.publication.bytes, 123);
  assert.equal(result.function.name, 'func-test');
  assert.equal(result.dataServices, null);
  assert.equal(JSON.stringify(result).includes('private-error'), false);
});
