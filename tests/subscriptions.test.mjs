import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listSubscriptions,
  readSubscription,
  saveSubscription,
  scopeInventory,
  SUBSCRIPTION_KEY,
} from '../src/core/inventory/subscriptions.js';
import { tableView } from '../src/core/table/index.js';

const files = {
  subscriptions: {
    headers: ['subscriptionId', 'subscriptionName', 'state'],
    rows: [
      ['prod', 'Producción', 'Enabled'],
      ['dev', 'Desarrollo', 'Enabled'],
      ['empty', 'Vacía', 'Enabled'],
      ['off', 'Deshabilitada', 'Disabled'],
    ],
  },
  'resource-types': {
    headers: ['subscriptionId', 'subscriptionName', 'resourceProvider', 'type', 'resources'],
    rows: [
      ['prod', 'Producción', 'microsoft.compute', 'microsoft.compute/virtualmachines', '12'],
      ['prod', 'Producción', 'microsoft.storage', 'microsoft.storage/storageaccounts', '2'],
      ['dev', 'Desarrollo', 'microsoft.compute', 'microsoft.compute/virtualmachines', '30'],
    ],
  },
  'virtual-machines': {
    headers: ['subscriptionId', 'subscriptionName', 'name', 'osType'],
    rows: [
      ['prod', 'Producción', 'vm1', 'Linux'],
      ['prod', 'Producción', 'vm2', 'Windows'],
      ['dev', 'Desarrollo', 'vm3', 'Windows'],
    ],
  },
  'tags-by-subscription': {
    headers: [
      'subscriptionName',
      'subscriptionId',
      'tag_product',
      'resources',
      'resourceProviders',
      'types',
    ],
    rows: [
      [
        'Producción',
        'prod',
        'pagos',
        '14',
        'microsoft.compute=12; microsoft.storage=2',
        'microsoft.compute/virtualmachines=12; microsoft.storage/storageaccounts=2',
      ],
      [
        'Desarrollo',
        'dev',
        'pagos',
        '30',
        'microsoft.compute=30',
        'microsoft.compute/virtualmachines=30',
      ],
    ],
  },
  tags: {
    headers: [
      'subscriptionName',
      'subscriptionId',
      'tag_product',
      'resources',
      'resourceProviders',
      'types',
    ],
    rows: [
      [
        'ALL',
        'ALL',
        'pagos',
        '44',
        'microsoft.compute=42; microsoft.storage=2',
        'microsoft.compute/virtualmachines=42; microsoft.storage/storageaccounts=2',
      ],
    ],
  },
  'resource-totals': {
    headers: ['subscriptionName', 'subscriptionId', 'resources'],
    rows: [
      ['Producción', 'prod', '14'],
      ['Desarrollo', 'dev', '30'],
      ['ALL', '', '44'],
    ],
  },
};

test('el selector incluye suscripciones vacías, deshabilitadas y datos sin catálogo', () => {
  assert.deepEqual(listSubscriptions(files), [
    { id: 'dev', name: 'Desarrollo', state: 'Enabled' },
    { id: 'off', name: 'Deshabilitada', state: 'Disabled' },
    { id: 'prod', name: 'Producción', state: 'Enabled' },
    { id: 'empty', name: 'Vacía', state: 'Enabled' },
  ]);
  assert.deepEqual(
    listSubscriptions({ 'resource-totals': files['resource-totals'] }).map((item) => item.id),
    ['dev', 'prod'],
  );
  assert.deepEqual(listSubscriptions({}), []);
});

test('filtra todas las vistas sin modificar el inventario original ni mantener el total ALL', () => {
  const original = structuredClone(files);
  const scoped = scopeInventory(files, 'prod');
  for (const file of Object.values(scoped)) {
    const index = file.headers.indexOf('subscriptionId');
    assert.ok(file.rows.every((row) => row[index] === 'prod'));
  }
  assert.equal(scoped['virtual-machines'].rows.length, 2);
  assert.deepEqual(scoped['resource-totals'].rows, [['Producción', 'prod', '14']]);
  assert.deepEqual(files, original);
  assert.equal(scopeInventory(files, ''), files);
});

test('las etiquetas globales de una selección proceden del informe por suscripción', () => {
  const scoped = scopeInventory(files, 'prod');
  assert.deepEqual(scoped['tags'].rows, [
    [
      'Producción',
      'prod',
      'pagos',
      '14',
      'microsoft.compute=12; microsoft.storage=2',
      'microsoft.compute/virtualmachines=12; microsoft.storage/storageaccounts=2',
    ],
  ]);
  assert.equal(files['tags'].rows[0][3], '44');
  const withoutSource = { ...files };
  delete withoutSource['tags-by-subscription'];
  assert.equal(scopeInventory(withoutSource, 'prod')['tags'], undefined);
  assert.equal(scopeInventory(withoutSource, '')['tags'], files['tags']);
});

test('una suscripción vacía conserva su ficha y devuelve cero recursos en todas las vistas', () => {
  const scoped = scopeInventory(files, 'empty');
  assert.equal(scoped['subscriptions'].rows.length, 1);
  for (const [id, file] of Object.entries(scoped))
    if (id !== 'subscriptions') assert.deepEqual(file.rows, []);
});

test('combina el filtro global con búsqueda, filtros de columna, agrupación', () => {
  const scoped = scopeInventory(files, 'prod');
  const vms = tableView(scoped['virtual-machines'], { search: 'vm', filters: { 3: 'Windows' } });
  assert.deepEqual(vms.rows, [['prod', 'Producción', 'vm2', 'Windows']]);
  const types = tableView(scoped['resource-types'], { groupBy: 'resourceProvider' });
  assert.deepEqual(types.rows, [
    ['microsoft.compute', '1', '12'],
    ['microsoft.storage', '1', '2'],
  ]);
});

test('guarda la selección y recupera todas las suscripciones al borrar la preferencia', () => {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  assert.equal(readSubscription(storage), '');
  saveSubscription(storage, 'prod');
  assert.equal(entries.get(SUBSCRIPTION_KEY), 'prod');
  assert.equal(readSubscription(storage), 'prod');
  saveSubscription(storage, '');
  assert.equal(entries.has(SUBSCRIPTION_KEY), false);
  assert.equal(readSubscription(storage), '');
});

test('permite filtrar aunque localStorage esté bloqueado o no exista', () => {
  const blocked = new Proxy(
    {},
    {
      get() {
        throw new Error('SecurityError');
      },
    },
  );
  for (const storage of [blocked, undefined]) {
    assert.equal(readSubscription(storage), '');
    assert.doesNotThrow(() => saveSubscription(storage, 'prod'));
    assert.doesNotThrow(() => saveSubscription(storage, ''));
  }
  assert.equal(scopeInventory(files, 'prod')['virtual-machines'].rows.length, 2);
});
