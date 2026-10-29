import { REPORTS } from '../src/core/inventory/reports.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { Readable } from 'node:stream';
import { handleRefresh as handleLockedRefresh } from '../server/refresh/handleRefresh.mjs';
import { collectAzure } from '../server/modules/azure/services/collectAzure.mjs';
import { readAzureSnapshot } from '../server/modules/azure/storage/source.mjs';
import { refreshInventory } from '../src/features/inventory/api/refreshInventory.js';
import { azureDocument } from './fixtures/azure-document.mjs';

const origin = 'https://goliat.example';
const env = { SITE_URL: origin, INVENTORY_REFRESH_TIMEOUT_MS: '1000' };

function handleRefresh(request, refresh, options) {
  return handleLockedRefresh(request, refresh, {
    lock: async (_provider, work, { signal }) => work({ signal }),
    ...options,
  });
}

function request(path = '/api/inventory/azure/refresh/', headers = { origin }, signal) {
  return new Request(`${origin}${path}`, { method: 'POST', headers, signal });
}

test('la actualización manual importa el blob completo antes de confirmar el POST', async () => {
  const bytes = Buffer.from(JSON.stringify(azureDocument()));
  const calls = [];
  const client = {
    url: 'https://example.blob.core.windows.net',
    getContainerClient: () => ({
      getBlobClient: () => ({
        async getProperties({ abortSignal }) {
          assert.equal(abortSignal.aborted, false);
          calls.push('properties');
          return { etag: 'v2', contentLength: bytes.length };
        },
        async download(_offset, _count, { conditions }) {
          assert.equal(conditions.ifMatch, 'v2');
          calls.push('download');
          return { readableStreamBody: Readable.from([bytes]) };
        },
      }),
    }),
  };
  const response = await handleRefresh(
    request(),
    ({ signal }) =>
      collectAzure({
        env: { AZURE_STORAGE_CONTAINER: 'inventory' },
        client,
        signal,
        async save(files, metadata) {
          assert.equal(Object.keys(files).length, REPORTS.length);
          assert.equal(metadata.storage.etag, 'v2');
          await delay(1);
          calls.push('saved');
          return { runId: 'new', skipped: false };
        },
      }),
    { env, provider: 'azure' },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { runId: 'new', skipped: false });
  assert.deepEqual(calls, ['properties', 'download', 'saved']);
});

test('el origen incorrecto o ausente se rechaza antes de acceder a cloud', async () => {
  for (const headers of [
    {},
    { origin: 'https://other.example' },
    { origin, 'sec-fetch-site': 'cross-site' },
  ]) {
    const response = await handleRefresh(
      request(undefined, headers),
      async () => {
        assert.fail('No debe ejecutarse la ingesta.');
      },
      { env },
    );
    assert.equal(response.status, 403);
  }
});

test('el plazo cancela la lectura y devuelve 504 aunque el SDK lance AbortError', async () => {
  const response = await handleRefresh(
    request(),
    async ({ signal }) => {
      await delay(1000, undefined, { signal });
      assert.fail('No debe continuar tras el timeout.');
    },
    { env: { ...env, INVENTORY_REFRESH_TIMEOUT_MS: '5' }, provider: 'azure' },
  );
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: 'refresh_timeout' });
});

test('un plazo inválido no ejecuta el colector; los errores no exponen secretos', async () => {
  const invalid = await handleRefresh(
    request(),
    async () => assert.fail('Configuración inválida.'),
    {
      env: { ...env, INVENTORY_REFRESH_TIMEOUT_MS: '0' },
    },
  );
  assert.equal(invalid.status, 503);
  assert.deepEqual(await invalid.json(), { error: 'refresh_unconfigured' });
  const failed = await handleRefresh(
    request(),
    async () => {
      throw new Error('password=secreto; blob=https://secret.example');
    },
    { env, provider: 'azure' },
  );
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: 'refresh_unavailable' });
});

test('la cancelación del cliente se propaga y no permite persistir un blob descargado', async () => {
  const controller = new AbortController();
  const response = await handleRefresh(
    request(undefined, undefined, controller.signal),
    ({ signal }) =>
      collectAzure({
        signal,
        source: async () => {
          controller.abort();
          return azureDocument().snapshot;
        },
        save: async () => assert.fail('No debe guardar después de cancelar.'),
      }),
    { env, provider: 'azure' },
  );
  assert.equal(response.status, 499);
});

test('Blob Storage propagan la cancelación del cliente a sus SDK', async () => {
  const controller = new AbortController();
  const signals = [];
  await assert.rejects(
    readAzureSnapshot({
      env: { AZURE_STORAGE_CONTAINER: 'inventory' },
      signal: controller.signal,
      client: {
        getContainerClient: () => ({
          getBlobClient: () => ({
            async getProperties({ abortSignal }) {
              signals.push(abortSignal);
              throw new Error('simulated');
            },
          }),
        }),
      },
    }),
    /simulated/,
  );
  controller.abort();
  assert.equal(signals.length, 1);
  assert.ok(signals.every((signal) => signal.aborted));
});

test('la UI espera al POST Azure antes de consultar el snapshot de PostgreSQL', async () => {
  const calls = [];
  const inventory = { files: {}, errors: [], metadata: { generatedAt: 'new' } };
  const data = await refreshInventory({
    baseUrl: `${origin}/`,
    fetcher: async (url, options) => {
      calls.push(options.method);
      assert.equal(options.credentials, 'same-origin');
      if (options.method === 'POST') {
        assert.equal(new URL(url).pathname, '/api/inventory/azure/refresh/');
        await delay(1);
        calls.push('imported');
        return Response.json({ skipped: false });
      }
      assert.equal(calls.at(-2), 'imported');
      return Response.json(inventory);
    },
  });
  assert.deepEqual(calls, ['POST', 'imported', 'GET']);
  assert.deepEqual(data.files, inventory.files);
});

test('un fallo de importación no se anuncia como éxito ni dispara una consulta posterior', async () => {
  for (const refresh of [(fetcher) => refreshInventory({ baseUrl: `${origin}/`, fetcher })]) {
    const calls = [];
    await assert.rejects(
      refresh(async (_url, { method }) => {
        calls.push(method);
        return Response.json({ error: 'refresh_unavailable' }, { status: 503 });
      }),
      /HTTP 503/,
    );
    assert.deepEqual(calls, ['POST']);
  }
});
