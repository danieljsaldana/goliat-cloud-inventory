import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseAdministration } from '../server/administration/databaseAdministration.mjs';
import { publishedInventory } from '../server/administration/publishedInventory.mjs';
import { formatBytes } from '../src/features/administration/utils/formatBytes.js';

test('PostgreSQL consulta datos reales en una transacción de lectura, limita el tiempo y solo devuelve campos públicos', async () => {
  const calls = [];
  const state = { released: false };
  const pool = {
    connect: async () => ({
      query: async (input) => {
        calls.push(input);
        return {
          rows: [
            {
              name: 'cloud_inventory',
              version: '17.9',
              bytes: '10485760',
              tls: true,
              reports: '52',
              rows: '182',
              password: 'private-value',
            },
          ],
        };
      },
      release: () => {
        state.released = true;
      },
    }),
  };
  const env = {
    DB_HOST: 'postgres.example',
    DB_PORT: '5432',
    DB_USER: 'private-user',
    DB_PASSWORD: 'private-value',
  };
  const data = await databaseAdministration({ env, pool });
  assert.deepEqual(data, {
    name: 'cloud_inventory',
    host: 'postgres.example',
    port: 5432,
    version: '17.9',
    bytes: 10485760,
    tls: true,
    reports: 52,
    rows: 182,
  });
  assert.equal(calls[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.match(calls[1], /statement_timeout = '10s'/);
  assert.equal(calls[2].query_timeout, 10000);
  assert.match(calls[2].text, /h\.provider = 'azure'/);
  assert.match(calls[2].text, /pg_stat_ssl WHERE pid = pg_backend_pid\(\)/);
  assert.equal(calls.at(-1), 'COMMIT');
  assert.equal(state.released, true);
  assert.equal(JSON.stringify(data).includes('private-'), false);
});

test('PostgreSQL conserva valores cero y ausencia de TLS, libera conexiones ante un fallo y respeta la cancelación inicial', async () => {
  const state = { fail: false, released: 0 };
  const calls = [];
  const pool = {
    connect: async () => ({
      query: async (input) => {
        calls.push(input);
        if (typeof input === 'object' && state.fail) throw new Error('failed');
        return {
          rows: [
            { name: 'empty', version: '17.9', bytes: '0', tls: false, reports: '0', rows: '0' },
          ],
        };
      },
      release: () => {
        state.released++;
      },
    }),
  };
  const data = await databaseAdministration({ env: {}, pool });
  assert.equal(data.bytes, 0);
  assert.equal(data.reports, 0);
  assert.equal(data.rows, 0);
  assert.equal(data.tls, false);
  state.fail = true;
  await assert.rejects(databaseAdministration({ env: {}, pool }), /failed/);
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.equal(state.released, 2);
  const count = calls.length;
  await assert.rejects(databaseAdministration({ env: {}, pool, signal: AbortSignal.abort() }));
  assert.equal(calls.length, count);
});

test('Storage utiliza propiedades del archivo, conserva su ETag y descarta metadatos y credenciales ajenos', async () => {
  const env = {
    AZURE_STORAGE_CONTAINER: 'cloud-inventory',
    AZURE_STORAGE_BLOB: 'azure/latest.json',
  };
  const client = {
    url: 'https://storage.blob.core.windows.net/?sig=private-value',
    getContainerClient: (name) => {
      assert.equal(name, 'cloud-inventory');
      return {
        getBlobClient: (blob) => {
          assert.equal(blob, 'azure/latest.json');
          return {
            getProperties: async ({ abortSignal }) => {
              assert.ok(abortSignal instanceof AbortSignal);
              return {
                metadata: {
                  resources: '45',
                  generatedat: '2026-10-10T18:30:00Z',
                  secret: 'private-value',
                },
                lastModified: new Date('2026-10-10T18:31:00Z'),
                contentLength: 12345,
                etag: 'verified-version',
                accessTier: 'Hot',
                contentType: 'application/json',
                isServerEncrypted: true,
              };
            },
          };
        },
      };
    },
  };
  const data = await publishedInventory({ env, client });
  assert.deepEqual(data, {
    generatedAt: '2026-10-10T18:30:00Z',
    lastModified: '2026-10-10T18:31:00.000Z',
    resources: 45,
    bytes: 12345,
    etag: 'verified-version',
    storage: {
      endpoint: 'https://storage.blob.core.windows.net',
      container: 'cloud-inventory',
      blob: 'azure/latest.json',
      tier: 'Hot',
      contentType: 'application/json',
      encrypted: true,
    },
  });
  assert.equal(JSON.stringify(data).includes('private-value'), false);
  assert.equal(JSON.stringify(data).includes('sig='), false);
});

test('los tamaños distinguen datos ausentes de cero y usan unidades binarias en ambos idiomas', () => {
  assert.equal(formatBytes(null, 'es-ES'), '—');
  assert.equal(formatBytes(undefined, 'es-ES'), '—');
  assert.equal(formatBytes(-1, 'es-ES'), '—');
  assert.equal(formatBytes(0, 'es-ES'), '0 B');
  assert.equal(formatBytes(1536, 'es-ES'), '1,5 KiB');
  assert.equal(formatBytes(1572864, 'en-US'), '1.5 MiB');
});
