import test from 'node:test';
import assert from 'node:assert/strict';
import { armClient } from '../src/azure/arm.mjs';
import { collectAzure } from '../src/azure/collect.mjs';
import { loadConfig } from '../src/config.mjs';
import { SUBSCRIPTION, TENANT } from './fixture.mjs';

test('ARM reintenta 429 y no envía tokens a continuaciones de otro host', async () => {
  const calls = [];
  const client = armClient(
    { getToken: async () => ({ token: 'test-token' }) },
    {
      sleep: async () => {},
      fetcher: async (url) => {
        calls.push(url.href);
        if (calls.length === 1) return new Response('', { status: 429 });
        return new Response(
          JSON.stringify({ value: [], nextLink: 'https://attacker.invalid/data' }),
        );
      },
    },
  );
  await assert.rejects(client.list('/subscriptions/list'), /Endpoint ARM no permitido/);
  assert.equal(calls.length, 2);
});

test('Resource Graph pagina sin saltos y un resultado truncado impide publicar', async () => {
  const state = { pages: 0, tokens: [] };
  const arm = {
    list: async () => [],
    request: async (path, options) => {
      if (path.startsWith('/subscriptions/'))
        return {
          subscriptionId: SUBSCRIPTION,
          displayName: 'Demo',
          state: 'Enabled',
          tenantId: TENANT,
        };
      state.pages += 1;
      state.tokens.push(options.body.options.$skipToken);
      return {
        data: [
          {
            id: `/subscriptions/${SUBSCRIPTION}/resourceGroups/demo/providers/Microsoft.Storage/storageAccounts/st${state.pages}`,
            name: `st${state.pages}`,
            type: 'Microsoft.Storage/storageAccounts',
            subscriptionId: SUBSCRIPTION,
          },
        ],
        totalRecords: 2,
        resultTruncated: state.pages === 1,
        ...(state.pages === 1 ? { $skipToken: 'page-2' } : {}),
      };
    },
  };
  const result = await collectAzure(arm, { subscriptionIds: [SUBSCRIPTION] });
  assert.equal(result.resources.length, 2);
  assert.deepEqual(state.tokens, [undefined, 'page-2']);
  const broken = {
    ...arm,
    request: async (path) =>
      path.startsWith('/subscriptions/')
        ? { subscriptionId: SUBSCRIPTION, state: 'Enabled' }
        : { data: [], resultTruncated: true },
  };
  await assert.rejects(collectAzure(broken, { subscriptionIds: [SUBSCRIPTION] }), /truncó/);
});

test('no ignora permisos fallidos ni permite destinos o suscripciones inválidos', async () => {
  await assert.rejects(
    collectAzure(
      {
        request: async () => {
          throw new Error('Forbidden');
        },
      },
      { subscriptionIds: [SUBSCRIPTION] },
    ),
    /Forbidden/,
  );
  assert.throws(() =>
    loadConfig({
      INVENTORY_SUBSCRIPTION_IDS: SUBSCRIPTION,
      AZURE_STORAGE_ACCOUNT_URL: 'https://attacker.invalid/',
    }),
  );
  assert.throws(() =>
    loadConfig({
      INVENTORY_SUBSCRIPTION_IDS: `${SUBSCRIPTION},${SUBSCRIPTION}`,
      AZURE_STORAGE_ACCOUNT_URL: 'https://demo.blob.core.windows.net/',
    }),
  );
});

test('PostgreSQL y MySQL se enriquecen con ARM y un error impide publicar datos incompletos', async () => {
  const requests = [];
  const resources = [
    'Microsoft.DBforPostgreSQL/flexibleServers',
    'Microsoft.DBforMySQL/flexibleServers',
  ].map((type, index) => ({
    id: `/subscriptions/${SUBSCRIPTION}/resourceGroups/demo/providers/${type}/database-${index}`,
    subscriptionId: SUBSCRIPTION,
    resourceGroup: 'demo',
    name: `database-${index}`,
    type,
  }));
  const arm = {
    list: async () => [],
    request: async (path) => {
      requests.push(path);
      if (path.includes('/Microsoft.ResourceGraph/'))
        return { data: resources, totalRecords: resources.length };
      if (path.includes('/providers/'))
        return {
          ...resources.find((resource) => path.startsWith(resource.id)),
          properties: { storage: { storageSizeGB: 32 } },
        };
      return { subscriptionId: SUBSCRIPTION, state: 'Enabled' };
    },
  };
  const result = await collectAzure(arm, { subscriptionIds: [SUBSCRIPTION] });
  assert.equal(result.resources[0].properties.storage.storageSizeGB, 32);
  assert.ok(requests.includes(`${resources[0].id}?api-version=2024-08-01`));
  assert.ok(requests.includes(`${resources[1].id}?api-version=2024-12-30`));
  await assert.rejects(
    collectAzure(
      {
        ...arm,
        request: async (path, options) => {
          if (path.startsWith(resources[0].id)) throw new Error('Database unavailable');
          return arm.request(path, options);
        },
      },
      { subscriptionIds: [SUBSCRIPTION] },
    ),
    /Database unavailable/,
  );
});
