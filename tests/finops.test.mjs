import test from 'node:test';
import assert from 'node:assert/strict';
import { costPeriod } from '../src/core/finops/period.js';
import { summarizeCosts } from '../src/core/finops/summary.js';
import { resourceShares } from '../src/core/finops/resourceShares.js';
import { costSettings } from '../server/finops/settings.mjs';
import { costQueryRows } from '../server/finops/queryRows.mjs';
import { costClient } from '../server/finops/client.mjs';
import { getCosts } from '../server/finops/service.mjs';
import { handleCosts } from '../server/finops/handleCosts.mjs';
import { COST_LIMITS } from '../server/finops/limits.mjs';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-10-11T12:00:00Z');
const period = costPeriod('2026-10', now);
const resource = `/subscriptions/${first}/resourceGroups/shared/providers/Microsoft.Compute/virtualMachines/vm-one`;
const columns = ['PreTaxCost', 'UsageDate', 'ResourceId', 'ServiceName', 'Currency'].map(
  (name) => ({ name }),
);
const page = (rows, nextLink = null) => ({ properties: { columns, rows, nextLink } });
const credential = { getToken: async () => ({ token: 'server-only' }) };

test('Cost queries cap process-wide concurrency and reuse an in-flight request before rejecting excess load', async () => {
  const gate = Promise.withResolvers();
  const calls = { count: 0 };
  const options = {
    now,
    env: { FINOPS_SUBSCRIPTION_IDS: first, AZURE_CLIENT_ID: 'security-concurrency-check' },
    client: {
      query: async () => {
        calls.count += 1;
        await gate.promise;
        return [];
      },
    },
  };
  const pending = [getCosts(options), getCosts({ ...options, basis: 'AmortizedCost' })];
  const shared = getCosts(options);
  try {
    assert.equal(calls.count, COST_LIMITS.concurrentQueries);
    await assert.rejects(getCosts({ ...options, month: '2026-09' }), { status: 429 });
    const busy = await handleCosts(new Request('https://goliat.example/api/finops/costs/'), {
      read: () => getCosts({ ...options, month: '2026-09' }),
    });
    assert.equal(busy.status, 429);
    assert.equal(busy.headers.get('Retry-After'), '5');
  } finally {
    gate.resolve();
    await Promise.all([...pending, shared]);
  }
  await getCosts({ ...options, month: '2026-09' });
  assert.equal(calls.count, 3);
});

test('Aggregate costs remain bounded across subscriptions and oversized responses never claim full coverage', async () => {
  const row = {
    date: '2026-10-01',
    amount: 1,
    resourceId: '',
    serviceName: 'VM',
    currency: 'EUR',
    subscriptionId: first,
  };
  const result = await getCosts({
    now,
    cached: false,
    env: { FINOPS_SUBSCRIPTION_IDS: `${first},${second}` },
    client: {
      query: async (id) =>
        id === first ? Array(COST_LIMITS.rows).fill(row) : [{ ...row, subscriptionId: second }],
    },
  });
  assert.equal(result.rows.length, COST_LIMITS.rows);
  assert.equal(result.status, 'partial');
  assert.equal(result.subscriptions[1].status, 'unavailable');
  const oversized = await getCosts({
    now,
    cached: false,
    env: { FINOPS_SUBSCRIPTION_IDS: first },
    client: { query: async () => [{ ...row, serviceName: 'x'.repeat(COST_LIMITS.resultBytes) }] },
  });
  assert.equal(oversized.rows.length, 0);
  assert.equal(oversized.status, 'unavailable');
});

test('FinOps bounds periods to twelve UTC calendar months, rejects future periods and handles leap years', () => {
  assert.deepEqual(period, {
    month: '2026-10',
    from: '2026-10-01T00:00:00.000Z',
    to: now.toISOString(),
  });
  assert.equal(costPeriod('2024-02', new Date('2024-03-02')).to, '2024-02-29T23:59:59.999Z');
  assert.equal(costPeriod('2025-11', now).month, '2025-11');
  for (const month of ['2026-11', '2025-10', '2026-13', '2026-1', 'abc'])
    assert.throws(() => costPeriod(month, now));
});

test('FinOps subscriptions and auth configuration reject arbitrary scopes, duplicates and excessive queries', () => {
  assert.deepEqual(costSettings({ FINOPS_SUBSCRIPTION_IDS: first.toUpperCase() }), {
    ids: [first],
    mode: 'default',
  });
  assert.throws(() => costSettings({ FINOPS_SUBSCRIPTION_IDS: `${first},${first}` }));
  assert.throws(() => costSettings({ FINOPS_SUBSCRIPTION_IDS: '/subscriptions/private' }));
  assert.throws(() => costSettings({ FINOPS_AUTH_MODE: 'browser' }));
});

test('Cost Management columns are read by name and invalid values never become zero', () => {
  const rows = costQueryRows(
    page([[1.25, 20261002, resource, 'Virtual Machines', 'EUR']]).properties,
    first,
    period,
  );
  assert.equal(rows[0].amount, 1.25);
  assert.equal(rows[0].date, '2026-10-02');
  for (const row of [
    [null, 20261002, resource, 'VM', 'EUR'],
    [2, 20260231, resource, 'VM', 'EUR'],
    [2, 20261012, resource, 'VM', 'EUR'],
    [2, 20261002, resource.replace(first, second), 'VM', 'EUR'],
  ])
    assert.throws(() => costQueryRows(page([row]).properties, first, period));
  const reordered = { columns: [...columns].reverse(), rows: [['EUR', 'VM', '', 20261002, -3]] };
  assert.equal(costQueryRows(reordered, first, period)[0].amount, -3);
});

test('Cost queries follow all pages using POST, the original body and a server token', async () => {
  const requests = [];
  const next = `https://management.azure.com/subscriptions/${first}/providers/Microsoft.CostManagement/query?api-version=2025-03-01&$skiptoken=next`;
  const client = costClient(credential, {
    fetcher: async (url, options) => {
      requests.push({ url: String(url), options });
      return Response.json(
        requests.length === 1
          ? page([[1, 20261001, resource, 'VM', 'EUR']], next)
          : page([[2, 20261002, '', 'Reservations', 'EUR']]),
      );
    },
  });
  const rows = await client.query(first, period, 'AmortizedCost', AbortSignal.timeout(1000));
  assert.equal(rows.length, 2);
  assert.equal(requests[1].url, next);
  assert.ok(
    requests.every(
      ({ options }) =>
        options.method === 'POST' && options.headers.authorization === 'Bearer server-only',
    ),
  );
  assert.equal(requests[0].options.body, requests[1].options.body);
  assert.equal(JSON.parse(requests[0].options.body).type, 'AmortizedCost');
});

test('Cost pagination rejects another host, another subscription and repeated continuations', async () => {
  for (const next of [
    'https://evil.example/query',
    `https://management.azure.com/subscriptions/${second}/providers/Microsoft.CostManagement/query?api-version=2025-03-01`,
    `https://management.azure.com/subscriptions/${first}/providers/Microsoft.CostManagement/query?api-version=2025-03-01`,
  ]) {
    const calls = [];
    const client = costClient(credential, {
      fetcher: async (url) => {
        calls.push(url);
        return Response.json(page([], next));
      },
    });
    await assert.rejects(client.query(first, period, 'ActualCost'));
    assert.equal(calls.length, 1);
  }
});

test('Azure throttling is bounded and an empty 204 response remains no records', async () => {
  const sleeps = [];
  const calls = { count: 0 };
  const client = costClient(credential, {
    sleep: async (delay) => {
      sleeps.push(delay);
    },
    fetcher: async () => {
      calls.count += 1;
      return calls.count === 1
        ? new Response(null, { status: 429, headers: { 'retry-after': '1' } })
        : new Response(null, { status: 204 });
    },
  });
  assert.deepEqual(await client.query(first, period, 'ActualCost'), []);
  assert.deepEqual(sleeps, [1000]);
  const limited = costClient(credential, {
    fetcher: async () => new Response(null, { status: 429, headers: { 'retry-after': '60' } }),
  });
  await assert.rejects(limited.query(first, period, 'ActualCost'), { status: 429 });
});

test('FinOps retains available subscriptions and keeps permission failures explicit', async () => {
  const result = await getCosts({
    now,
    cached: false,
    env: { FINOPS_SUBSCRIPTION_IDS: `${first},${second}` },
    client: {
      query: async (id) => {
        if (id === second) throw Object.assign(new Error('private Azure detail'), { status: 403 });
        return costQueryRows(
          page([[0, 20261001, resource, 'VM', 'EUR']]).properties,
          first,
          period,
        );
      },
    },
  });
  assert.equal(result.status, 'partial');
  assert.equal(result.rows[0].amount, 0);
  assert.equal(result.subscriptions[1].status, 'forbidden');
  assert.ok(!JSON.stringify(result).includes('private Azure detail'));
  const empty = await getCosts({
    now,
    cached: false,
    env: {},
    inventory: async () => ({ files: {} }),
  });
  assert.equal(empty.status, 'not-configured');
});

test('Concurrent FinOps requests share a private cache without mixing cost bases or identities', async () => {
  const count = { calls: 0 };
  const options = {
    now,
    env: { FINOPS_SUBSCRIPTION_IDS: second },
    client: {
      query: async () => {
        count.calls += 1;
        return [];
      },
    },
  };
  await Promise.all([getCosts(options), getCosts(options)]);
  assert.equal(count.calls, 1);
  await getCosts({ ...options, basis: 'AmortizedCost' });
  await getCosts({ ...options, env: { ...options.env, AZURE_CLIENT_ID: first } });
  assert.equal(count.calls, 3);
});

test('Totals separate currencies, retain credits and resource-less charges, and leave missing days as gaps', () => {
  const rows = costQueryRows(
    page([
      [10, 20261001, resource, 'VM', 'EUR'],
      [-2, 20261001, resource.toUpperCase(), 'VM', 'EUR'],
      [4, 20261003, '', 'Reservations', 'EUR'],
      [1000, 20261001, resource, 'VM', 'USD'],
    ]).properties,
    first,
    period,
  );
  const data = {
    period,
    rows,
    subscriptions: [
      { id: first, name: 'One', status: 'ready' },
      { id: second, name: 'Two', status: 'forbidden' },
    ],
  };
  const summary = summarizeCosts(data, { currency: 'EUR' });
  assert.equal(summary.total, 12);
  assert.equal(summary.resources.length, 2);
  assert.equal(summary.chargedResources, 1);
  assert.equal(
    summarizeCosts({ ...data, rows: [...rows, { ...rows[0], serviceName: 'Other service' }] })
      .chargedResources,
    1,
  );
  assert.equal(summary.resources[0].amount, 8);
  assert.equal(summary.daily[1].amount, null);
  assert.equal(summary.partial, true);
  assert.equal(summarizeCosts(data, { currency: 'USD' }).total, 1000);
  const unavailable = summarizeCosts(data, { subscription: second });
  assert.equal(unavailable.rows.length, 0);
  assert.equal(unavailable.partial, true);
});

test('Resource charts aggregate services and credits by ARM identity without merging equal names or rounding costs', () => {
  const row = (
    amount,
    resourceId,
    serviceName = 'VM',
    subscriptionId = first,
    currency = 'EUR',
  ) => ({
    amount,
    resourceId,
    serviceName,
    subscriptionId,
    currency,
    date: '2026-10-01',
  });
  const otherGroup = resource.replace('/shared/', '/other/');
  const otherSubscription = resource.replace(first, second);
  const data = {
    period,
    subscriptions: [
      { id: first, name: 'One', status: 'ready' },
      { id: second, name: 'Two', status: 'ready' },
    ],
    rows: [
      row(30.5429, resource),
      row(-2, resource.toUpperCase(), 'Storage'),
      row(5, otherGroup),
      row(7, otherSubscription, 'VM', second),
      row(3, '', 'Reservations'),
      row(1000, resource, 'VM', first, 'USD'),
    ],
  };
  const summary = summarizeCosts(data, { group: 'resourceId', currency: 'EUR' });
  assert.equal(summary.groups.length, 4);
  assert.equal(summary.groups[0].amount, 28.5429);
  assert.equal(summary.groups[0].resourceId, resource);
  assert.equal(new Set(summary.groups.map(({ key }) => key)).size, 4);
  assert.equal(summary.groups.filter(({ name }) => name === 'vm-one').length, 3);
  assert.equal(summary.groups.find(({ resourceId }) => !resourceId).amount, 3);
  assert.equal(summary.total, 43.5429);
  assert.equal(
    summarizeCosts(data, { group: 'resourceId', currency: 'USD' }).groups[0].amount,
    1000,
  );
  assert.equal(
    summarizeCosts(data, { group: 'resourceId', subscription: second }).groups.length,
    1,
  );
});

test('Resource pie shares use net positive balances, combine services and retain negative and zero balances', () => {
  const entry = (amount, id = resource, subscriptionId = first) => ({
    amount,
    resourceId: id,
    subscriptionId,
    name: id.split('/').at(-1),
    serviceName: amount < 0 ? 'Storage' : 'VM',
  });
  const shares = resourceShares([
    entry(30.5429),
    entry(-2, resource.toUpperCase()),
    entry(5, resource.replace('/shared/', '/other/')),
    entry(7, resource.replace(first, second), second),
    entry(3, ''),
    entry(-4, resource + '-refund'),
    entry(0, resource + '-zero'),
  ]);
  assert.equal(shares.entries.length, 6);
  assert.equal(shares.positiveTotal, 43.5429);
  assert.equal(shares.credits, -4);
  assert.equal(shares.slices.length, 4);
  assert.equal(shares.entries[0].amount, 28.5429);
  assert.deepEqual(shares.entries[0].services, ['Storage', 'VM']);
  assert.equal(shares.entries[0].share, 28.5429 / 43.5429);
  assert.ok(Math.abs(shares.slices.reduce((sum, { share }) => sum + share, 0) - 1) < 1e-12);
  assert.ok(
    shares.entries.filter(({ amount }) => amount <= 0).every(({ share }) => share === null),
  );
  const empty = resourceShares([entry(-1), entry(0, '')]);
  assert.equal(empty.positiveTotal, 0);
  assert.equal(empty.slices.length, 0);
  assert.equal(empty.entries.length, 2);
  assert.ok(empty.entries.every(({ share }) => share === null));
});

test('The resource pie groups the remainder without changing individual percentages or the denominator', () => {
  const shares = resourceShares(
    Array.from({ length: 1000 }, (_, index) => ({
      amount: 1000 - index,
      resourceId: resource + index,
      subscriptionId: first,
    })),
  );
  assert.equal(shares.entries.length, 1000);
  assert.equal(shares.positiveTotal, 500500);
  assert.equal(shares.slices.length, 6);
  assert.equal(shares.slices[5].other, true);
  assert.equal(shares.slices[5].count, 995);
  assert.equal(shares.slices[5].amount, 500500 - 4990);
  assert.equal(shares.entries[999].share, 1 / 500500);
  assert.ok(Math.abs(shares.slices.reduce((sum, { share }) => sum + share, 0) - 1) < 1e-12);
});

test('The cost API rejects query injection and invalid periods without exposing Azure errors', async () => {
  const request = (query) => new Request(`https://goliat.example/api/finops/costs/?${query}`);
  for (const query of [
    'subscriptionId=private',
    'month=2026-10&month=2026-09',
    'scope=https://evil.example',
  ]) {
    const response = await handleCosts(request(query), {
      read: async () => assert.fail('must not query Azure'),
    });
    assert.equal(response.status, 400);
  }
  const response = await handleCosts(request('month=2026-13'), {
    read: async () => {
      throw new TypeError('invalid_cost_period');
    },
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const failed = await handleCosts(request(''), {
    read: async () => {
      throw new Error('secret Azure details');
    },
  });
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes('secret'));
});
