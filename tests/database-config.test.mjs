import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { databaseConfig } from '../server/config.mjs';

const env = { DB_HOST: 'postgres.example', DB_USER: 'goliat', DB_NAME: 'inventory' };

test('PostgreSQL verifica TLS con CA del sistema, CA propia o admite local sin TLS', async () => {
  assert.deepEqual(databaseConfig(env).ssl, { rejectUnauthorized: true });
  assert.deepEqual(databaseConfig({ ...env, DB_SSL_CA_PATH: '  ' }).ssl, {
    rejectUnauthorized: true,
  });
  assert.equal(databaseConfig({ ...env, DB_SSL: 'false' }).ssl, undefined);
  assert.throws(() => databaseConfig({ ...env, DB_SSL: 'invalid' }));
  const directory = await mkdtemp(join(tmpdir(), 'goliat-ca-'));
  try {
    const path = join(directory, 'postgres.pem');
    await writeFile(path, 'test-ca');
    assert.deepEqual(databaseConfig({ ...env, DB_SSL_CA_PATH: path }).ssl, {
      ca: 'test-ca',
      rejectUnauthorized: true,
    });
    assert.throws(() => databaseConfig({ ...env, DB_SSL_CA_PATH: join(directory, 'missing.pem') }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
