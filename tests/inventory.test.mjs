import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { loadInventory } from '../src/features/inventory/api/loadInventory.js';

const baseUrl = new URL('https://example.test/');
const inventory = {
  files: {
    subscriptions: {
      headers: ['subscriptionId', 'subscriptionName'],
      rows: [['demo', 'Demo']],
    },
  },
  metadata: { generatedAt: '2026-10-09T00:00:00Z' },
  errors: [],
};

test('carga el inventario con una peticion a la API sin cache y conserva los esquemas', async () => {
  const fetcher = mock.fn(async (url, options) => {
    assert.equal(url.href, 'https://example.test/api/inventory/azure/');
    assert.equal(options.cache, 'no-store');
    return Response.json(inventory);
  });
  const result = await loadInventory({
    baseUrl,
    fetcher,
  });
  assert.equal(fetcher.mock.callCount(), 1);
  assert.deepEqual(result, { ...inventory, loading: false });
});

test('el backend vacio es un inventario sin recursos, no un error', async () => {
  const result = await loadInventory({
    baseUrl,
    fetcher: async () => Response.json({ files: {}, metadata: null, errors: [] }),
  });
  assert.deepEqual(result.files, {});
  assert.deepEqual(result.errors, []);
});

test('no convierte un fallo de la base de datos en un inventario vacio', async () => {
  await assert.rejects(
    loadInventory({
      baseUrl,
      fetcher: async () => Response.json({ error: 'inventory_unavailable' }, { status: 503 }),
    }),
    /503/,
  );
});

test('rechaza respuestas que romperian los filtros y tablas', async () => {
  for (const value of [
    {},
    { files: { demo: {} }, errors: [] },
    { files: { demo: { headers: ['id'], rows: [[1]] } }, errors: [] },
  ]) {
    await assert.rejects(loadInventory({ baseUrl, fetcher: async () => Response.json(value) }));
  }
});

test('cancelar una carga no entrega datos a una vista desmontada', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    loadInventory({
      baseUrl,
      signal: controller.signal,
      fetcher: async () => Response.json(inventory),
    }),
    { name: 'AbortError' },
  );
});
