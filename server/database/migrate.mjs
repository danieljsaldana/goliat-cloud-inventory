import { getMigrationPool } from '../db.mjs';
import { integer } from '../config.mjs';
import { loadMigrations } from './loadMigrations.mjs';
import { compareMigrations } from './utils/compareMigrations.mjs';
import {
  MIGRATION_LOCK,
  MIGRATION_LOCK_TIMEOUT_MS,
  MIGRATION_STATEMENT_TIMEOUT_MS,
} from './constants.mjs';
import { MigrationError } from './errors.mjs';
import { getLogger } from '../logging/logger.mjs';

export async function migrate(pool, { directory, env = process.env } = {}) {
  const migrations = await loadMigrations(directory);
  if (!migrations.length) return { applied: [], skipped: 0 };
  const lockTimeout = integer(env.DB_MIGRATION_LOCK_TIMEOUT_MS, MIGRATION_LOCK_TIMEOUT_MS, 60000);
  const statementTimeout = integer(
    env.DB_MIGRATION_STATEMENT_TIMEOUT_MS,
    MIGRATION_STATEMENT_TIMEOUT_MS,
    3600000,
  );
  const connection = await (pool || getMigrationPool()).connect();
  const state = { locked: false, discard: false };
  try {
    const {
      rows: [lock],
    } = await connection.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', [
      MIGRATION_LOCK,
    ]);
    if (!lock.acquired)
      throw new MigrationError(
        'Otra migración está en curso. Esperar a que termine y reintentar.',
        'MIGRATION_BUSY',
      );
    state.locked = true;
    await connection.query(
      "SELECT set_config('lock_timeout', $1, false), set_config('statement_timeout', $2, false)",
      [`${lockTimeout}ms`, `${statementTimeout}ms`],
    );
    await connection.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    );
    const { rows } = await connection.query(
      'SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name',
    );
    const status = compareMigrations(migrations, rows);
    if (status.drift.length || status.missingFiles.length || status.outOfOrder.length)
      throw new MigrationError(
        `Historial de migraciones incompatible: ${[...status.drift, ...status.missingFiles, ...status.outOfOrder].join(', ')}. No modificar ni eliminar SQL ya aplicado.`,
      );
    const applied = [];
    for (const migration of migrations) {
      if (!status.pending.includes(migration.name)) continue;
      const started = performance.now();
      await connection.query('BEGIN');
      try {
        await connection.query(migration.sql);
        await connection.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          migration.name,
          migration.checksum,
        ]);
        await connection.query('COMMIT');
        applied.push(migration.name);
        getLogger().info(
          {
            event: 'migration.applied',
            migration: migration.name,
            durationMs: Math.round(performance.now() - started),
          },
          'Migración aplicada correctamente.',
        );
      } catch (error) {
        try {
          await connection.query('ROLLBACK');
        } catch {
          state.discard = true;
        }
        throw error;
      }
    }
    return { applied, skipped: migrations.length - applied.length };
  } finally {
    try {
      if (state.locked && !state.discard) {
        await connection.query('RESET lock_timeout');
        await connection.query('RESET statement_timeout');
        await connection.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK]);
      }
    } catch (error) {
      state.discard = true;
      throw error;
    } finally {
      connection.release(state.discard);
    }
  }
}
