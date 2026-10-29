import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMigrations } from '../server/database/loadMigrations.mjs';
import { compareMigrations } from '../server/database/utils/compareMigrations.mjs';
import { migrate } from '../server/database/migrate.mjs';
import { assertSchemaReady } from '../server/database/status.mjs';
import { migrationDatabaseConfig } from '../server/config.mjs';

test('el historial detecta drift, huecos aplicados y SQL desconocido, y permite lectores antiguos', () => {
  const migrations = [
    { name: '001_one.sql', version: 1, checksum: 'a' },
    { name: '002_two.sql', version: 2, checksum: 'b' },
  ];
  assert.deepEqual(compareMigrations(migrations, []).pending, ['001_one.sql', '002_two.sql']);
  assert.deepEqual(
    compareMigrations(migrations, [{ name: '001_one.sql', checksum: 'changed' }]).drift,
    ['001_one.sql'],
  );
  assert.deepEqual(
    compareMigrations(migrations, [{ name: '002_two.sql', checksum: 'b' }]).outOfOrder,
    ['001_one.sql'],
  );
  const future = [
    { name: '001_one.sql', checksum: 'a' },
    { name: '002_two.sql', checksum: 'b' },
    { name: '003_future.sql', checksum: 'c' },
  ];
  const status = compareMigrations(migrations, future);
  assert.equal(status.ready, true);
  assert.deepEqual(status.missingFiles, ['003_future.sql']);
});

test('los ficheros SQL se ordenan, normalizan saltos de línea y rechazan versiones ambiguas', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dashboard-migrations-'));
  try {
    await writeFile(join(directory, '001_one.sql'), 'SELECT 1;\r\n');
    const first = await loadMigrations(directory);
    await writeFile(join(directory, '001_one.sql'), 'SELECT 1;\n');
    assert.equal((await loadMigrations(directory))[0].checksum, first[0].checksum);
    await writeFile(join(directory, '003_gap.sql'), 'SELECT 3;');
    await assert.rejects(loadMigrations(directory), /consecutivas/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('el migrador descarta una conexión si no puede liberar su bloqueo', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'migration-cleanup-'));
  const calls = [];
  const connection = {
    query: async (sql) => {
      calls.push(sql);
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
      if (sql.startsWith('SELECT name')) return { rows: [] };
      if (sql.includes('pg_advisory_unlock')) throw new Error('conexión rota');
      return { rows: [] };
    },
    release: (discard) => calls.push({ discard }),
  };
  try {
    await writeFile(join(directory, '001_one.sql'), 'SELECT 1;\n');
    await assert.rejects(
      migrate({ connect: async () => connection }, { directory }),
      /conexión rota/,
    );
    assert.deepEqual(calls.at(-1), { discard: true });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('un punto de partida sin SQL no conecta ni registra historial y sigue pendiente de esquema', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'migration-empty-'));
  const pool = {
    connect: async () => {
      throw new Error('Una migración vacía no debe conectar.');
    },
    query: async (sql) => {
      assert.equal(sql, "SELECT to_regclass('schema_migrations') AS name");
      return { rows: [{ name: null }] };
    },
  };
  try {
    assert.deepEqual(await loadMigrations(directory), []);
    assert.deepEqual(await migrate(pool, { directory }), { applied: [], skipped: 0 });
    await writeFile(join(directory, '001_initial.sql'), '');
    assert.deepEqual(await loadMigrations(directory), []);
    assert.deepEqual(await migrate(pool, { directory }), { applied: [], skipped: 0 });
    assert.equal(compareMigrations([], []).ready, false);
    await assert.rejects(assertSchemaReady(pool, { directory }), { code: 'SCHEMA_NOT_READY' });
    await writeFile(join(directory, '002_expand.sql'), 'SELECT 2;\n');
    await assert.rejects(loadMigrations(directory), /consecutivas/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('las credenciales del migrador pueden usar un writer y usuario propios sin alterar el pool web', () => {
  const base = {
    DB_HOST: 'reader',
    DB_NAME: 'inventory',
    DB_USER: 'web',
    DB_PASSWORD: 'web-password',
    DB_SSL: 'false',
    DB_MIGRATION_PASSWORD: '',
  };
  assert.equal(migrationDatabaseConfig(base).password, 'web-password');
  const config = migrationDatabaseConfig({
    ...base,
    DB_MIGRATION_HOST: 'writer',
    DB_MIGRATION_USER: 'migrator',
    DB_MIGRATION_PASSWORD: 'ddl-password',
  });
  assert.equal(config.host, 'writer');
  assert.equal(config.user, 'migrator');
  assert.equal(config.password, 'ddl-password');
  assert.equal(config.max, 1);
  assert.equal(base.DB_HOST, 'reader');
});
