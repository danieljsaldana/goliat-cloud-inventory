import { getMigrationPool } from '../db.mjs';
import { initialSchemaStatus } from './initialStatus.mjs';
import { loadInitialSchema } from './utils/loadInitialSchema.mjs';
import { MIGRATION_LOCK } from './constants.mjs';
import { MigrationError } from './errors.mjs';

export async function initializeDatabase(pool = getMigrationPool()) {
  const initial = await loadInitialSchema();
  const connection = await pool.connect();
  const state = { discard: false };
  try {
    await connection.query('BEGIN');
    await connection.query("SET LOCAL lock_timeout = '5s'");
    await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', [MIGRATION_LOCK]);
    const status = await initialSchemaStatus(connection);
    if (status.initialized) {
      if (!status.ready)
        throw new MigrationError(
          'El esquema existente no coincide con esta versión. db:init no modifica tablas existentes.',
        );
      await connection.query('COMMIT');
      return { initialized: false, ready: true, version: initial.version };
    }
    const { rows } = await connection.query(
      'SELECT tablename FROM pg_tables WHERE schemaname = current_schema()',
    );
    if (rows.length)
      throw new MigrationError(
        'db:init requiere una base vacía; no modifica ni elimina tablas existentes.',
      );
    await connection.query(initial.sql);
    await connection.query('INSERT INTO inventory_schema (version, checksum) VALUES ($1, $2)', [
      initial.version,
      initial.checksum,
    ]);
    await connection.query('COMMIT');
    return { initialized: true, ready: true, version: initial.version };
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
    } catch {
      state.discard = true;
    }
    throw error;
  } finally {
    connection.release(state.discard);
  }
}
