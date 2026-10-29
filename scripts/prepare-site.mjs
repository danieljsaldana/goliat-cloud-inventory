import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import files from '../server/modules/azure/seed/data/inventory.json' with { type: 'json' };
import { records } from '../src/core/table/index.js';
import { getCategoryOverview, resourceTags } from '../src/core/inventory/categories.js';
import { translate } from '../src/core/i18n/translate.js';
import english from '../src/core/i18n/locales/en.js';
import spanish from '../src/core/i18n/locales/es.js';
import { inventoryTagKeys } from '../src/features/administration/utils/inventoryTagKeys.js';

const assets = new URL('../site/assets/', import.meta.url);
await mkdir(assets, { recursive: true });
await mkdir(new URL('pagination/utils/', assets), { recursive: true });
await mkdir(new URL('admin/', assets), { recursive: true });
await copyFile(
  new URL('../public/social/cloud-inventory.png', import.meta.url),
  new URL('cloud-inventory.png', assets),
);
for (const name of ['architecture', 'azure-deployment']) {
  await copyFile(new URL(`../docs/${name}.html`, import.meta.url), new URL(`${name}.html`, assets));
}
for (const [source, name] of [
  ['pagination/utils/pageWindow.js', 'pageWindow.js'],
  ['pagination/utils/pageItems.js', 'pagination/utils/pageItems.js'],
  ['pagination/constants.js', 'pagination/constants.js'],
  ['table/utils/sumBy.js', 'sumBy.js'],
  ['table/utils/number.js', 'number.js'],
]) {
  await copyFile(new URL(`../src/core/${source}`, import.meta.url), new URL(name, assets));
}
for (const file of [
  'metricPeriods.js',
  'serviceMetricsConstants.js',
  'utils/inventorySyncState.js',
  'utils/formatBytes.js',
]) {
  await copyFile(
    new URL(`../src/features/administration/${file}`, import.meta.url),
    new URL(`admin/${file.split('/').at(-1)}`, assets),
  );
}
await copyFile(
  new URL('../src/core/inventory/tagKeys.js', import.meta.url),
  new URL('admin/tagKeys.js', assets),
);
const groups = ['compute', 'containers', 'web', 'network', 'databases', 'security', 'tags'];
const resources = records(files.resources).map((row, index) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  provider: row.resourceProvider,
  subscriptionId: row.subscriptionId,
  subscriptionName: row.subscriptionName,
  resourceGroup: row.resourceGroup,
  location: row.location,
  tags: resourceTags(row),
  demoCostCents: ((index % 11) + 1) * 437,
}));
const subscriptions = records(files.subscriptions).map((row) => ({
  id: row.subscriptionId,
  name: row.subscriptionName,
  state: row.state,
}));
const categories = groups.map((group) => ({
  id: group,
  labels: Object.fromEntries(
    ['en', 'es'].map((locale) => [locale, translate(locale, `groups.${group}`)]),
  ),
  resourceIds: getCategoryOverview(files, group).rows.map(({ id }) => id),
}));
const management = {
  source: 'synthetic-management-example',
  tenantId: '00000000-0000-4000-8000-000000000000',
  members: [
    ['Demo Admin', 'admin', 'administrator', true, true],
    ['Demo Operator', 'operator', 'administrator', true, false],
    ['Demo FinOps', 'finops', 'member', true, false],
    ['Demo Reader', 'reader', 'member', true, false],
    ['Demo Guest', 'guest', 'member', true, false],
    ['Demo Disabled', 'disabled', 'member', false, false],
  ].map(([name, alias, role, enabled, protectedAdministrator], index) => ({
    objectId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name,
    email: `${alias}@demo.example`,
    role,
    enabled,
    protectedAdministrator,
    self: index === 0,
  })),
};
const checkedAt = '2026-10-01T12:00:00.000Z';
function metric(id, unit, aggregation, base, spread, offset, { gap = false } = {}) {
  return {
    id,
    unit,
    aggregation,
    data: Array.from({ length: 168 }, (_, index) => {
      const time = new Date(Date.parse(checkedAt) - (167 - index) * 3600000).toISOString();
      const value = Math.round((base + (((index * 13 + offset) % 19) / 18) * spread) * 10) / 10;
      if (id === 'executions')
        return { time, value: time.slice(11, 13) === '02' || index % 31 === 0 ? 1 : 0 };
      const sample = unit === 'count' ? Math.round(value) : value;
      return { time, value: gap && index === 160 ? null : sample };
    }),
  };
}
management.administration = {
  checkedAt,
  labels: Object.fromEntries(
    [
      ['en', english],
      ['es', spanish],
    ].map(([locale, catalog]) => [
      locale,
      Object.fromEntries(Object.entries(catalog).filter(([key]) => key.startsWith('admin.'))),
    ]),
  ),
  function: {
    name: 'func-goliat-demo',
    location: 'West Europe',
    runtime: 'Node.js 22',
    memoryMB: 512,
    maximumInstances: 40,
    hostName: 'function.demo.example',
  },
  schedule: { enabled: true, mode: 'daily', time: '02:00', hours: 6 },
  availableTags: inventoryTagKeys(files),
  tags: ['environment', 'product', 'cost_center'],
  publication: {
    generatedAt: '2026-10-01T02:00:00.000Z',
    etag: '"demo-snapshot-v1"',
    resources: resources.length,
    reports: Object.keys(files).length,
    rows: Object.values(files).reduce((sum, file) => sum + file.rows.length, 0),
    bytes: Buffer.byteLength(JSON.stringify(files)),
    storage: {
      blob: 'azure/latest.json',
      container: 'cloud-inventory',
      tier: 'Hot',
      encrypted: true,
      endpoint: 'https://storage.demo.example',
    },
  },
  database: {
    name: 'goliat_demo',
    host: 'postgres.demo.example',
    port: 5432,
    version: 'PostgreSQL 17',
    tls: true,
    bytes: 16 * 1048576,
  },
  metrics: [
    metric('executions', 'count', 'Total', 0, 0, 0),
    metric('memory', 'bytes', 'Average', 110 * 1048576, 55 * 1048576, 2),
    metric('cpu', 'percent', 'Average', 1, 11, 5),
  ],
  databaseMetrics: [
    metric('cpu', 'percent', 'Average', 12, 34, 6),
    metric('memory', 'percent', 'Average', 37, 22, 8),
    metric('connections', 'count', 'Average', 3, 10, 9),
    metric('disk', 'bytes', 'Average', 8 * 1073741824, 200 * 1048576, 4),
  ],
  storageMetrics: [
    metric('transactions', 'count', 'Total', 12, 180, 11),
    metric('ingress', 'bytes', 'Total', 2048, 100 * 1024, 7),
    metric('egress', 'bytes', 'Total', 16384, 300 * 1024, 5, { gap: true }),
    metric('latency', 'milliseconds', 'Average', 6, 22, 12),
  ],
};
await writeFile(
  new URL('demo-data.json', assets),
  JSON.stringify({
    source: 'repository-demo-seed',
    resources,
    subscriptions,
    categories,
    management,
  }),
);
console.log('Portada preparada con Archify y el inventario ficticio del repositorio.');
