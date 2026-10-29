import test from 'node:test';
import assert from 'node:assert/strict';
import { getOverviewData } from '../src/core/inventory/overview.js';

const file = (headers, rows) => ({ headers, rows });

test('el resumen agrupa por proveedor nativo y excluye la fila ALL de los totales', () => {
  const files = {
    'resource-totals': file(
      ['subscriptionId', 'subscriptionName', 'resources'],
      [
        ['a', 'Producción', '12'],
        ['b', 'Desarrollo', '8'],
        ['', 'ALL', '20'],
      ],
    ),
    'resource-types': file(
      ['subscriptionId', 'subscriptionName', 'resourceProvider', 'type', 'resources'],
      [
        ['a', 'Producción', 'microsoft.compute', 'microsoft.compute/virtualmachines', '12'],
        ['b', 'Desarrollo', 'microsoft.compute', 'microsoft.compute/disks', '2'],
        ['b', 'Desarrollo', 'microsoft.storage', 'microsoft.storage/storageaccounts', '6'],
      ],
    ),
    'tag-coverage': file(
      ['resources', 'withTags'],
      [
        ['12', '10'],
        ['8', '8'],
      ],
    ),
  };
  const before = structuredClone(files);
  const result = getOverviewData(files);
  assert.equal(result.total, 20);
  assert.equal(result.providerCount, 2);
  assert.equal(result.activeSubscriptions, 2);
  assert.equal(result.coveragePercent, 90);
  assert.deepEqual(result.providers, [
    ['microsoft.compute', 14],
    ['microsoft.storage', 6],
  ]);
  assert.deepEqual(result.subscriptionEntries, [
    ['Producción', 12, 'a'],
    ['Desarrollo', 8, 'b'],
  ]);
  assert.deepEqual(files, before);
});

test('el resumen funciona con solo el detalle de recursos y con una selección vacía', () => {
  const result = getOverviewData({
    resources: file(
      ['subscriptionId', 'subscriptionName', 'resourceProvider', 'type', 'location'],
      [
        ['a', 'Demo', 'microsoft.compute', 'microsoft.compute/virtualmachines', 'westeurope'],
        ['a', 'Demo', 'microsoft.web', 'microsoft.web/sites', 'westeurope'],
      ],
    ),
  });
  assert.equal(result.total, 2);
  assert.equal(result.hasResourceData, true);
  assert.equal(result.providerCount, 2);
  assert.deepEqual(result.locations, [['westeurope', 2]]);
  assert.equal(result.activeSubscriptions, 1);
  assert.equal(result.coveragePercent, null);
  const empty = getOverviewData({});
  assert.equal(empty.hasResourceData, false);
  assert.equal(empty.total, 0);
  assert.equal(empty.providerCount, 0);
  assert.equal(empty.coveragePercent, null);
  assert.deepEqual(empty.providers, []);
  assert.deepEqual(empty.subscriptionEntries, []);
});

test('distingue un inventario cargado sin recursos de unos datos no disponibles', () => {
  for (const id of ['resource-totals', 'resource-types', 'resources']) {
    const result = getOverviewData({ [id]: file(['subscriptionId', 'resources'], []) });
    assert.equal(result.hasResourceData, true, id);
    assert.equal(result.total, 0, id);
    assert.deepEqual(result.providers, [], id);
    assert.deepEqual(result.locations, [], id);
  }
  const catalogOnly = getOverviewData({
    subscriptions: file(['subscriptionId', 'subscriptionName'], [['empty', 'Vacía']]),
  });
  assert.equal(catalogOnly.hasResourceData, false);
});

test('agrupa tipos anidados y proveedores nuevos sin un catálogo de categorías propio', () => {
  const result = getOverviewData({
    'resource-types': file(
      ['subscriptionId', 'subscriptionName', 'resourceProvider', 'type', 'resources'],
      [
        ['a', 'Demo', 'microsoft.sql', 'microsoft.sql/servers', '2'],
        ['a', 'Demo', 'microsoft.sql', 'microsoft.sql/servers/databases', '6'],
        ['a', 'Demo', 'microsoft.cache', 'microsoft.cache/redis', '3'],
        ['a', 'Demo', 'microsoft.cache', 'microsoft.cache/redisenterprise', '2'],
        ['a', 'Demo', 'contoso.service', 'contoso.service/widgets', '1'],
      ],
    ),
  });
  assert.equal(result.total, 14);
  assert.equal(result.providerCount, 3);
  assert.deepEqual(result.providers, [
    ['microsoft.sql', 8],
    ['microsoft.cache', 5],
    ['contoso.service', 1],
  ]);
});
