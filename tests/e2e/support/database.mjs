import pg from 'pg';
import { databaseConfig } from '../../../server/config.mjs';

export function assertTestDatabase() {
  if (process.env.RUN_DB_TESTS !== '1' || !process.env.DB_NAME?.endsWith('_test')) {
    throw new Error(
      'Las pruebas E2E requieren RUN_DB_TESTS=1 y una base temporal terminada en _test. No se carga .env.',
    );
  }
  if (!process.env.DB_HOST || !process.env.DB_USER || process.env.DB_SSL !== 'false') {
    throw new Error(
      'Configura explícitamente DB_HOST, DB_USER y DB_SSL=false para el PostgreSQL temporal.',
    );
  }
}

export function testSchema() {
  assertTestDatabase();
  const schema = process.env.GOLIAT_E2E_SCHEMA;
  if (!/^e2e_[0-9a-f]{32}$/.test(schema || '')) throw new Error('Esquema E2E inválido.');
  return schema;
}

export function testPool({ scoped = true } = {}) {
  assertTestDatabase();
  return new pg.Pool({
    ...databaseConfig(),
    max: 2,
    options: scoped ? `-c search_path=${testSchema()}` : '',
  });
}
