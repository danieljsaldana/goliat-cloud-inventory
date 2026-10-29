import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function probe(overrides, operation = 'assertTestDatabase()') {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { assertTestDatabase, testSchema, testPool } from './tests/e2e/support/database.mjs'; ${operation}`,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        RUN_DB_TESTS: '1',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5432',
        DB_NAME: 'inventory_test',
        DB_USER: 'inventory',
        DB_PASSWORD: 'test-only',
        DB_SSL: 'false',
        GOLIAT_E2E_SCHEMA: 'e2e_0123456789abcdef0123456789abcdef',
        ...overrides,
      },
    },
  );
}

test('las pruebas de navegador exigen una base de pruebas explícita y no recuperan credenciales de .env', () => {
  assert.equal(probe({}).status, 0);
  for (const overrides of [
    { RUN_DB_TESTS: '' },
    { DB_NAME: 'cloud_inventory' },
    { DB_NAME: '' },
    { DB_HOST: '' },
    { DB_USER: '' },
    { DB_SSL: 'true' },
  ]) {
    const result = probe(overrides);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PostgreSQL temporal|base temporal/);
  }
  assert.notEqual(probe({ DB_NAME: 'cloud_inventory' }, 'testPool({ scoped: false })').status, 0);
});

test('la limpieza E2E solo acepta un identificador de esquema generado para la ejecución', () => {
  assert.equal(probe({}, 'testSchema()').status, 0);
  for (const schema of [
    'public',
    '',
    'e2e_demo',
    'e2e_0123456789abcdef0123456789abcdef; DROP SCHEMA public',
  ]) {
    const result = probe({ GOLIAT_E2E_SCHEMA: schema }, 'testSchema()');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Esquema E2E inválido/);
  }
});
