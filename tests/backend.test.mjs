import test from 'node:test';
import assert from 'node:assert/strict';
import { expandAzureRows } from '../server/modules/azure/normalization/utils/expandAzureRows.mjs';
import { reportTable } from '../server/modules/azure/normalization/utils/reportTable.mjs';
import { authenticationSettings, demoCredentials } from '../server/access.mjs';
import { transaction } from '../server/db.mjs';

test('los detalles Azure incluyen conexiones manuales y reglas predeterminadas', () => {
  const [endpoint] = expandAzureRows('private-endpoints', [
    {
      connections: [
        {
          properties: {
            privateLinkServiceConnectionState: { status: 'Approved' },
            groupIds: ['blob'],
          },
        },
      ],
      manualConnections: [
        {
          properties: {
            privateLinkServiceConnectionState: { status: 'Pending' },
            groupIds: ['vault'],
          },
        },
      ],
    },
  ]);
  assert.equal(endpoint.connectionStates, 'Approved; Pending');
  assert.deepEqual(JSON.parse(endpoint.groupIds), ['blob', 'vault']);
  const rules = expandAzureRows('network-security-rules', [
    {
      id: 'parent',
      customRules: [
        { name: 'allow', properties: { access: 'Allow', destinationPortRange: '443' } },
      ],
      defaultRules: [{ name: 'deny', properties: { access: 'Deny' } }],
    },
  ]);
  assert.equal(rules[1].ruleType, 'Default');
  assert.equal(new Set(rules.map((rule) => rule.id)).size, 2);
  const table = reportTable(
    'subscriptionName,subscriptionId,type,$TAG_COLUMNS,tags_json',
    [{ subscriptionId: 'one', type: 'Microsoft.Compute/disks', tags: { Environment: 'dev' } }],
    new Map([['one', 'One']]),
    ['environment'],
  );
  assert.equal(table.rows[0][2], 'microsoft.compute');
  assert.equal(table.rows[0][4], 'dev');
});

test('las transacciones revierten fallos y liberan la conexión', async () => {
  const calls = [];
  const connection = {
    query: async (query) => calls.push(query),
    release: () => calls.push('release'),
  };
  await assert.rejects(
    transaction(
      async () => {
        throw new Error('failed');
      },
      { connect: async () => connection },
    ),
    /failed/,
  );
  assert.deepEqual(calls, ['BEGIN', 'ROLLBACK', 'release']);
});

test('el dashboard permite desactivar el acceso y valida el modo demo', () => {
  assert.throws(() => authenticationSettings({ NODE_ENV: 'production' }));
  assert.throws(() => authenticationSettings({ NODE_ENV: 'development' }));
  assert.deepEqual(authenticationSettings({ DASHBOARD_AUTH_ENABLED: 'false' }), { enabled: false });
  const env = {
    NODE_ENV: 'production',
    AUTH_SECRET: 'test-only-secret-with-at-least-32-bytes',
    AUTH_URL: 'http://localhost:3000',
    DASHBOARD_USERNAME: 'viewer',
    DASHBOARD_PASSWORD: 'test:password',
  };
  const settings = authenticationSettings(env);
  assert.equal(demoCredentials(null, settings), null);
  assert.deepEqual(demoCredentials({ username: 'viewer', password: 'test:password' }, settings), {
    id: 'demo',
    name: 'viewer',
  });
  assert.equal(demoCredentials({ username: 'viewer', password: 'wrong' }, settings), null);
});

test('un ROLLBACK fallido conserva el error original y descarta la conexión', async () => {
  const original = new Error('original transaction error');
  const calls = [];
  const connection = {
    async query(sql) {
      calls.push(sql);
      if (sql === 'ROLLBACK') throw new Error('rollback failed');
    },
    release(discard) {
      calls.push({ discard });
    },
  };
  await assert.rejects(
    transaction(
      async () => {
        throw original;
      },
      { connect: async () => connection },
    ),
    (error) => error === original,
  );
  assert.deepEqual(calls, ['BEGIN', 'ROLLBACK', { discard: true }]);
});

test('una transacción confirmada devuelve el resultado y reutiliza la conexión', async () => {
  const calls = [];
  const connection = {
    async query(sql) {
      calls.push(sql);
    },
    release(discard) {
      calls.push({ discard });
    },
  };
  assert.equal(
    await transaction(async () => 42, { connect: async () => connection }, { readOnly: true }),
    42,
  );
  assert.deepEqual(calls, [
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    'COMMIT',
    { discard: false },
  ]);
});
