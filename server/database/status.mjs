import { getPool } from '../db.mjs';
import { loadMigrations } from './loadMigrations.mjs';
import { compareMigrations } from './utils/compareMigrations.mjs';
import { MigrationError } from './errors.mjs';
import { initialSchemaStatus } from './initialStatus.mjs';

export async function migrationStatus(pool = getPool(), { directory } = {}) {
  const migrations = await loadMigrations(directory);
  const {
    rows: [schema],
  } = await pool.query("SELECT to_regclass('schema_migrations') AS name");
  const applied = schema.name
    ? (await pool.query('SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name'))
        .rows
    : [];
  const status = compareMigrations(migrations, applied);
  if (!directory && !migrations.length) {
    const initialSchema = await initialSchemaStatus(pool);
    return { ...status, ready: initialSchema.ready && !applied.length, initialSchema };
  }
  return status;
}

export async function assertSchemaReady(pool = getPool(), options) {
  const status = await migrationStatus(pool, options);
  if (!status.ready)
    throw new MigrationError(
      'El esquema no está preparado para esta versión. Ejecutar db:status; para una base vacía, ejecutar db:init.',
      'SCHEMA_NOT_READY',
    );
  return status;
}
