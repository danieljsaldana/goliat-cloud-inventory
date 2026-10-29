import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chartRows } from '../src/features/inventory/components/overview/Bars/utils/chartRows.js';
import { providerLabel } from '../src/features/inventory/components/overview/Bars/utils/providerLabel.js';
import { resourceTypeLabel } from '../src/features/inventory/components/overview/Bars/utils/resourceTypeLabel.js';

test('las etiquetas de tipos anidados muestran solo el último tramo', () => {
  const cases = [
    ['microsoft.sql/managedinstances/databases', 'databases'],
    ['managedinstances/databases', 'databases'],
    ['microsoft.sql/servers/databases', 'databases'],
    ['microsoft.automation/automationaccounts/runbooks', 'runbooks'],
    ['microsoft.automation/automationaccounts/webhooks', 'webhooks'],
    ['microsoft.storage/storageaccounts/blobservices/containers', 'containers'],
    ['microsoft.compute/virtualmachines', 'virtualmachines'],
    ['storageaccounts', 'storageaccounts'],
  ];
  for (const [type, expected] of cases) assert.equal(resourceTypeLabel(type), expected, type);
});

test('los nombres completos se conservan aunque sean largos', () => {
  const name = 'ResourceTypeWithAnExtremelyLongNameThatMustRemainFullyVisibleWithoutEllipsis';
  assert.equal(resourceTypeLabel(`microsoft.example/parents/${name}`), name);
  assert.equal(providerLabel('Microsoft.MachineLearningServices'), 'MachineLearningServices');
  assert.equal(providerLabel('contoso.service'), 'contoso.service');
});

test('el eje y el tooltip comparten la etiqueta sin fusionar tipos con el mismo nombre', () => {
  const entries = [
    ['microsoft.sql/managedinstances/databases', 1],
    ['microsoft.sql/servers/databases', 3],
    ['microsoft.automation/automationaccounts/runbooks', 2],
  ];
  const original = structuredClone(entries);
  assert.deepEqual(chartRows(entries, resourceTypeLabel, 'Sin especificar'), [
    { id: entries[0][0], name: 'databases', resources: 1 },
    { id: entries[1][0], name: 'databases', resources: 3 },
    { id: entries[2][0], name: 'runbooks', resources: 2 },
  ]);
  assert.deepEqual(entries, original);
});

test('todos los tipos de la semilla se muestran completos y sin rutas en las gráficas', async () => {
  const files = JSON.parse(
    await readFile(
      new URL('../server/modules/azure/seed/data/inventory.json', import.meta.url),
      'utf8',
    ),
  );
  const file = files['resource-types'];
  const column = file.headers.indexOf('type');
  assert(column >= 0);
  const types = [...new Set(file.rows.map((row) => row[column]))];
  assert(types.includes('microsoft.sql/managedinstances/databases'));
  assert(types.includes('microsoft.automation/automationaccounts/runbooks'));
  for (const type of types) {
    const label = resourceTypeLabel(type);
    assert.equal(label, type.split('/').at(-1), type);
    assert(!label.includes('/'), type);
    assert(!label.includes('…'), type);
  }
});
