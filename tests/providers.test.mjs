import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAzureSnapshot } from '../server/modules/azure/normalization/normalizeSnapshot.mjs';
import { collectAzure } from '../server/modules/azure/services/collectAzure.mjs';
import { inventoryReportFilters } from '../server/modules/azure/queries/inventoryReportFilters.mjs';
import { REPORTS } from '../src/core/inventory/reports.js';

const special = new Set(['subscriptions', 'resource-totals', 'tags-by-subscription', 'tags']);

test('el normalizador Azure conserva false, cero, etiquetas y todas las vistas sin modificar el origen', () => {
  const raw = {
    catalog: [{ subscriptionId: 'sub', subscriptionName: 'Producción', state: 'Enabled' }],
    tagKeys: ['environment'],
    totals: [],
    tags: [],
    reports: REPORTS.filter(({ id }) => !special.has(id)).map(({ id }) => ({
      id,
      headers: 'subscriptionId,name,enabled,count,$TAG_COLUMNS,tags_json',
      rows:
        id === 'resources'
          ? [
              {
                subscriptionId: 'sub',
                name: 'á,"',
                enabled: false,
                count: 0,
                tags: { Environment: 'dev' },
              },
            ]
          : [],
    })),
  };
  const before = structuredClone(raw);
  const result = normalizeAzureSnapshot(raw, '2026-10-09T10:00:00Z');
  assert.equal(Object.keys(result.files).length, REPORTS.length);
  assert.deepEqual(result.files['resources'].rows[0], [
    'sub',
    'á,"',
    'false',
    '0',
    'dev',
    '{"Environment":"dev"}',
  ]);
  assert.equal(result.metadata.normalizationVersion, 2);
  assert.deepEqual(raw, before);
  assert.throws(
    () => normalizeAzureSnapshot({ ...raw, reports: [] }, '2026-10-09T10:00:00Z'),
    /incompleto/,
  );
});

test('los servicios no publican datos si falla el origen o la normalización', async () => {
  const saved = [];
  await assert.rejects(
    collectAzure({
      source: async () => {
        throw new Error('origen');
      },
      save: async (...value) => saved.push(value),
    }),
    /origen/,
  );
  await assert.rejects(
    collectAzure({
      source: async () => ({}),
      normalize: () => {
        throw new Error('contrato');
      },
      save: async (...value) => saved.push(value),
    }),
    /contrato/,
  );
  assert.deepEqual(saved, []);
});

test('las consultas de informes limitan las páginas y validan snapshot, cursor y ámbito', () => {
  assert.deepEqual(inventoryReportFilters('resources', new URLSearchParams()), {
    reportId: 'resources',
    runId: null,
    scope: null,
    after: -1,
    limit: 100,
  });
  const parsed = inventoryReportFilters(
    'resources',
    new URLSearchParams({ scope: "x' OR 1=1 --", after: '0', limit: '500' }),
  );
  assert.equal(parsed.scope, "x' OR 1=1 --");
  assert.equal(parsed.after, 0);
  for (const parameters of [
    { limit: '501' },
    { after: '-1' },
    { after: '1.2' },
    { after: '2147483648' },
    { runId: 'bad' },
    { scope: 'x'.repeat(129) },
  ])
    assert.throws(() => inventoryReportFilters('resources', new URLSearchParams(parameters)));
  assert.throws(() => inventoryReportFilters('unknown', new URLSearchParams()));
});
