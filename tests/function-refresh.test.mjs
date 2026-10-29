import test from 'node:test';
import assert from 'node:assert/strict';
import { functionClient } from '../server/modules/azure/services/functionClient.mjs';
import { refreshAzure } from '../server/modules/azure/services/refreshAzure.mjs';
import { refreshInventory } from '../src/features/inventory/api/refreshInventory.js';
import { readAzureSnapshot } from '../server/modules/azure/storage/source.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const origin = 'https://goliat.example';
const env = {
  SITE_URL: origin,
  AZURE_FUNCTION_BASE_URL: 'https://function.azurewebsites.net',
  AZURE_FUNCTION_SCOPE: `api://${id}/.default`,
};
const request = (method, operation = '') =>
  new Request(
    `${origin}/api/inventory/azure/refresh/${operation ? `?operationId=${operation}` : ''}`,
    { method, headers: { origin } },
  );

test('la web obtiene un access token de servicio y usa únicamente rutas fijas de la Function', async () => {
  const calls = [];
  const client = functionClient({
    env,
    credential: {
      async getToken(scope, { abortSignal }) {
        assert.equal(scope, env.AZURE_FUNCTION_SCOPE);
        assert.equal(abortSignal.aborted, false);
        return { token: 'service-access-token' };
      },
    },
    request: async (url, options) => {
      calls.push(url.pathname);
      assert.equal(options.headers.Authorization, 'Bearer service-access-token');
      assert.equal(options.redirect, 'error');
      if (options.method === 'GET') assert.equal(options.headers['Content-Type'], undefined);
      if (options.method === 'POST') assert.equal(options.body, '{}');
      return Response.json({
        operationId: id,
        status: 'queued',
        statusPath: 'https://untrusted.example/',
      });
    },
  });
  await client.generate();
  await client.operation(id);
  await client.current();
  assert.deepEqual(calls, [
    '/api/inventory/generate',
    `/api/inventory/operations/${id}`,
    '/api/inventory/operations/current',
  ]);
  assert.throws(() => client.operation('../../secret'));
  for (const override of [
    { AZURE_FUNCTION_SCOPE: 'https://graph.microsoft.com/.default' },
    { AZURE_FUNCTION_BASE_URL: 'http://function.example' },
  ])
    assert.throws(() => functionClient({ env: { ...env, ...override } }));
});

test('la Function sin operaciones devuelve JSON idle y se presenta como disponible', async () => {
  const client = functionClient({
    env,
    credential: { getToken: async () => ({ token: 'service-token' }) },
    request: async () => Response.json({ status: 'idle' }),
  });
  assert.equal(await client.current(), null);
  const response = await refreshAzure(request('GET'), {
    env,
    client,
    databaseStatus: async () => ({ running: false }),
  });
  assert.deepEqual(await response.json(), { running: false });
});

test('encola, consulta sin modificar PostgreSQL e importa solo después de confirmar la publicación', async () => {
  const calls = [];
  const operation = { operationId: id, status: 'queued' };
  const options = {
    env,
    client: {
      generate: async () => {
        calls.push('generate');
        return operation;
      },
      operation: async () => operation,
      current: async () => operation,
    },
    databaseStatus: async () => ({ running: false }),
    importHandler: async (_request, work, settings) => {
      assert.equal(settings.provider, 'azure');
      calls.push('locked-import');
      return Response.json(await work({ signal: new AbortController().signal }));
    },
    importInventory: async ({ expectedEtag }) => {
      assert.equal(expectedEtag, '"new"');
      calls.push('saved');
      return { runId: 'new' };
    },
  };
  const started = await refreshAzure(request('POST'), options);
  assert.equal(started.status, 202);
  assert.equal((await started.json()).operationId, id);
  assert.equal((await (await refreshAzure(request('GET', id), options)).json()).running, true);
  assert.equal((await refreshAzure(request('POST', id), options)).status, 202);
  assert.deepEqual(calls, ['generate']);
  operation.status = 'succeeded';
  operation.etag = '"new"';
  assert.equal((await (await refreshAzure(request('GET', id), options)).json()).running, false);
  const completed = await refreshAzure(request('POST', id), options);
  assert.equal(completed.status, 200);
  assert.deepEqual(await completed.json(), { runId: 'new' });
  assert.deepEqual(calls, ['generate', 'locked-import', 'saved']);
});

test('rechaza origen, identificadores y generaciones fallidas antes de importar', async () => {
  const options = {
    env,
    client: {
      operation: async () => ({ operationId: id, status: 'failed' }),
      generate: async () => assert.fail('No generar'),
    },
    importInventory: async () => assert.fail('No importar'),
  };
  const invalidOrigin = new Request(`${origin}/api/inventory/azure/refresh/`, {
    method: 'POST',
    headers: { origin: 'https://other.example' },
  });
  assert.equal((await refreshAzure(invalidOrigin, options)).status, 403);
  assert.equal((await refreshAzure(request('POST', 'invalid'), options)).status, 400);
  assert.equal((await refreshAzure(request('POST', id), options)).status, 502);
  const unavailable = await refreshAzure(request('POST'), { env: { SITE_URL: origin } });
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error, 'refresh_unconfigured');
});

test('no descarga un blob anterior o distinto del confirmado por la Function', async () => {
  await assert.rejects(
    readAzureSnapshot({
      env: { AZURE_STORAGE_CONTAINER: 'inventory' },
      expectedEtag: '"published"',
      client: {
        getContainerClient: () => ({
          getBlobClient: () => ({
            getProperties: async () => ({ etag: '"old"' }),
            download: async () => assert.fail('No descargar'),
          }),
        }),
      },
    }),
    /inventario publicado ha cambiado/,
  );
});

test('el navegador espera generación y guardado antes de recargar el dashboard', async () => {
  const calls = [];
  const statuses = ['queued', 'running', 'retrying', 'succeeded'];
  const inventory = { files: {}, errors: [], metadata: { generatedAt: 'new' } };
  await refreshInventory({
    baseUrl: `${origin}/`,
    wait: async () => {},
    fetcher: async (url, { method }) => {
      const operation = new URL(url).searchParams.get('operationId');
      if (method === 'POST' && !operation) {
        calls.push('generate');
        return Response.json({ operationId: id }, { status: 202 });
      }
      if (method === 'GET' && operation) {
        const status = statuses.shift();
        calls.push(status);
        return Response.json({ status });
      }
      if (method === 'POST') {
        calls.push('imported');
        return Response.json({ runId: 'new' });
      }
      calls.push('inventory');
      return Response.json(inventory);
    },
  });
  assert.deepEqual(calls, [
    'generate',
    'queued',
    'running',
    'retrying',
    'succeeded',
    'imported',
    'inventory',
  ]);
});

test('un fallo de generación o cancelar la espera no importa ni comunica éxito', async () => {
  const controller = new AbortController();
  for (const cancel of [false, true]) {
    const calls = [];
    await assert.rejects(
      refreshInventory({
        baseUrl: `${origin}/`,
        signal: controller.signal,
        wait: async () => {
          if (cancel) {
            controller.abort();
            controller.signal.throwIfAborted();
          }
        },
        fetcher: async (_url, { method }) => {
          calls.push(method);
          if (calls.length === 1) return Response.json({ operationId: id }, { status: 202 });
          return Response.json({ status: 'failed' });
        },
      }),
    );
    assert.deepEqual(calls, cancel ? ['POST'] : ['POST', 'GET']);
  }
});
