import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { withRefreshLock } from '../server/refresh/withRefreshLock.mjs';
import { getRefreshStatus } from '../server/refresh/getRefreshStatus.mjs';
import { handleRefresh } from '../server/refresh/handleRefresh.mjs';
import { REFRESH_LOCK_NAMESPACE } from '../server/refresh/constants.mjs';
import { databaseConfig } from '../server/config.mjs';
import { loadRefreshStatus } from '../src/services/refresh/status.js';
import { requestJson } from '../src/services/requestJson.js';

function fakePool({ acquired = true, unlockFails = false } = {}) {
  const calls = [];
  const connection = new EventEmitter();
  connection.query = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired }] };
    if (sql.includes('pg_advisory_unlock')) {
      if (unlockFails) throw new Error('cleanup failed');
      return { rows: [{ released: true }] };
    }
    return { rows: [] };
  };
  connection.release = (discard) => calls.push({ discard });
  return { calls, connection, connect: async () => connection };
}

test('el bloqueo se mantiene durante la importación y sus transacciones reutilizan la sesión', async () => {
  const pool = fakePool();
  await withRefreshLock(
    'azure',
    async ({ pool: scoped, signal }) => {
      assert.equal(signal.aborted, false);
      const writer = await scoped.connect();
      await writer.query('BEGIN');
      await writer.query('COMMIT');
      writer.release();
      assert.equal(
        pool.calls.some((call) => Object.hasOwn(call, 'discard')),
        false,
      );
    },
    { pool },
  );
  assert.deepEqual(pool.calls[0].values, [REFRESH_LOCK_NAMESPACE, 1]);
  assert.ok(pool.calls.at(-2).sql.includes('pg_advisory_unlock'));
  assert.deepEqual(pool.calls.at(-1), { discard: false });
  assert.equal(pool.connection.listenerCount('error'), 0);
});

test('un bloqueo ocupado responde 409 sin leer Storage', async () => {
  const pool = fakePool({ acquired: false });
  const request = new Request('https://goliat.example/api/inventory/azure/refresh/', {
    method: 'POST',
    headers: { origin: 'https://goliat.example' },
  });
  const response = await handleRefresh(
    request,
    async () => assert.fail('No debe iniciar la ingesta.'),
    {
      provider: 'azure',
      env: {},
      lock: (provider, work, options) => withRefreshLock(provider, work, { ...options, pool }),
    },
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'refresh_busy' });
  assert.deepEqual(pool.calls[0].values, [REFRESH_LOCK_NAMESPACE, 1]);
  assert.equal(
    pool.calls.some(({ sql }) => sql?.includes('pg_advisory_unlock')),
    false,
  );
});

test('la programación utiliza un bloqueo distinto de la importación de inventario', async () => {
  const pool = fakePool();
  await withRefreshLock('function-schedule', async () => undefined, { pool });
  assert.deepEqual(pool.calls[0].values, [REFRESH_LOCK_NAMESPACE, 2]);
  assert.deepEqual(pool.calls.at(-1), { discard: false });
});

test('un fallo revierte transacciones abiertas y libera el bloqueo para el siguiente usuario', async () => {
  const pool = fakePool();
  await assert.rejects(
    withRefreshLock(
      'azure',
      async () => {
        throw new Error('Storage failed');
      },
      { pool },
    ),
    /Storage failed/,
  );
  assert.equal(pool.calls.at(-3).sql, 'ROLLBACK');
  assert.ok(pool.calls.at(-2).sql.includes('pg_advisory_unlock'));
  assert.deepEqual(pool.calls.at(-1), { discard: false });
});

test('si falla la liberación se descarta la sesión, evitando reutilizar un bloqueo residual', async () => {
  const pool = fakePool({ unlockFails: true });
  await withRefreshLock('azure', async () => ({}), { pool });
  assert.deepEqual(pool.calls.at(-1), { discard: true });
});

test('la pérdida de conexión cancela la importación y descarta la sesión', async () => {
  const pool = fakePool();
  await assert.rejects(
    withRefreshLock(
      'azure',
      async ({ signal }) => {
        pool.connection.emit('error', new Error('connection lost'));
        signal.throwIfAborted();
      },
      { pool },
    ),
    /connection lost/,
  );
  assert.deepEqual(pool.calls.at(-1), { discard: true });
});

test('un timeout impide confirmar nuevas escrituras y permite limpiar la transacción', async () => {
  const pool = fakePool();
  const controller = new AbortController();
  await assert.rejects(
    withRefreshLock(
      'azure',
      async ({ pool: scoped }) => {
        controller.abort();
        await scoped.query('ROLLBACK');
        await scoped.query('COMMIT');
      },
      { pool, signal: controller.signal },
    ),
    { name: 'AbortError' },
  );
  assert.equal(
    pool.calls.some(({ sql }) => sql === 'COMMIT'),
    false,
  );
  assert.ok(pool.calls.at(-2).sql.includes('pg_advisory_unlock'));
});

test('la consulta de estado valida el contrato y el conflicto HTTP conserva su código', async () => {
  for (const provider of ['azure']) {
    const status = await loadRefreshStatus(provider, {
      fetcher: async (url, { method }) => {
        assert.ok(url.endsWith('/refresh/'));
        assert.equal(method, 'GET');
        return Response.json({ running: true });
      },
    });
    assert.deepEqual(status, { running: true });
  }
  await assert.rejects(
    loadRefreshStatus('azure', { fetcher: async () => Response.json({ running: 'false' }) }),
    /inválido/,
  );
  await assert.rejects(
    requestJson('/refresh/', {
      fetcher: async () => Response.json({ error: 'refresh_busy' }, { status: 409 }),
    }),
    {
      status: 409,
      code: 'refresh_busy',
    },
  );
});

test(
  'PostgreSQL: usuarios y réplicas comparten el bloqueo, con liberación tras desconexión',
  {
    skip: process.env.RUN_DB_TESTS !== '1',
  },
  async () => {
    assert.match(process.env.DB_NAME, /_test$/);
    const first = new pg.Pool({ ...databaseConfig(), max: 1 });
    const other = new pg.Pool({ ...databaseConfig(), max: 3 });
    const reader = new pg.Pool({ ...databaseConfig(), max: 1 });
    const gate = { enter: null, release: null };
    const entered = new Promise((resolve) => {
      gate.enter = resolve;
    });
    const hold = new Promise((resolve) => {
      gate.release = resolve;
    });
    const request = () =>
      new Request('https://goliat.example/api/inventory/azure/refresh/', {
        method: 'POST',
        headers: { origin: 'https://goliat.example' },
      });
    try {
      const active = handleRefresh(
        request(),
        async ({ pool }) => {
          const {
            rows: [owner],
          } = await pool.query('SELECT pg_backend_pid() AS pid');
          const client = await pool.connect();
          await client.query('BEGIN');
          const {
            rows: [writer],
          } = await client.query('SELECT pg_backend_pid() AS pid');
          assert.equal(owner.pid, writer.pid);
          await client.query('COMMIT');
          client.release();
          gate.enter();
          await hold;
          return { done: true };
        },
        {
          provider: 'azure',
          env: { INVENTORY_REFRESH_TIMEOUT_MS: '10000' },
          lock: (provider, work, options) =>
            withRefreshLock(provider, work, { ...options, pool: first }),
        },
      );
      await entered;
      assert.deepEqual(await getRefreshStatus('azure', reader), { running: true });
      const rejected = await Promise.all(
        Array.from({ length: 12 }, () =>
          handleRefresh(
            request(),
            async () => {
              assert.fail('No debe ejecutar otra actualización.');
            },
            {
              provider: 'azure',
              env: {},
              lock: (provider, work, options) =>
                withRefreshLock(provider, work, { ...options, pool: other }),
            },
          ),
        ),
      );
      assert.ok(rejected.every(({ status }) => status === 409));
      gate.release();
      assert.equal((await active).status, 200);
      assert.deepEqual(await getRefreshStatus('azure', reader), { running: false });
      await withRefreshLock('azure', async () => ({}), { pool: other });

      const failed = { enter: null };
      const failureStarted = new Promise((resolve) => {
        failed.enter = resolve;
      });
      const interrupted = withRefreshLock(
        'azure',
        async ({ pool, signal }) => {
          const {
            rows: [owner],
          } = await pool.query('SELECT pg_backend_pid() AS pid');
          failed.enter(owner.pid);
          await delay(10000, undefined, { signal });
        },
        { pool: first },
      );
      const outcome = assert.rejects(interrupted, { name: 'AbortError' });
      const pid = await failureStarted;
      await reader.query('SELECT pg_terminate_backend($1)', [pid]);
      await outcome;
      assert.deepEqual(await getRefreshStatus('azure', reader), { running: false });
      await withRefreshLock('azure', async () => ({}), { pool: other });
    } finally {
      gate.release?.();
      await Promise.all([first.end(), other.end(), reader.end()]);
    }
  },
);
