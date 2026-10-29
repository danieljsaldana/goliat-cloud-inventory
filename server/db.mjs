import pg from 'pg';
import { databaseConfig, migrationDatabaseConfig } from './config.mjs';
import { getLogger } from './logging/logger.mjs';

export function getPool() {
  if (!globalThis.__inventoryPool) {
    globalThis.__inventoryPool = new pg.Pool(databaseConfig());
    globalThis.__inventoryPool.on('error', (error) =>
      getLogger().error(
        { err: error, event: 'database.pool.failed' },
        'Error en el pool de conexiones de PostgreSQL.',
      ),
    );
  }
  return globalThis.__inventoryPool;
}

export async function closePool() {
  for (const key of ['__inventoryPool', '__inventoryMigrationPool', '__inventoryRefreshPool']) {
    if (globalThis[key]) {
      await globalThis[key].end();
      delete globalThis[key];
    }
  }
}

export function getRefreshPool() {
  if (!globalThis.__inventoryRefreshPool) {
    globalThis.__inventoryRefreshPool = new pg.Pool({
      ...databaseConfig(),
      max: 3,
      application_name: 'goliat-refresh',
    });
    globalThis.__inventoryRefreshPool.on('error', (error) =>
      getLogger().error(
        { err: error, event: 'database.refresh_pool.failed' },
        'Error en el pool de actualizaciones de PostgreSQL.',
      ),
    );
  }
  return globalThis.__inventoryRefreshPool;
}

export function getMigrationPool() {
  if (!globalThis.__inventoryMigrationPool) {
    globalThis.__inventoryMigrationPool = new pg.Pool(migrationDatabaseConfig());
    globalThis.__inventoryMigrationPool.on('error', (error) =>
      getLogger().error(
        { err: error, event: 'database.migration_pool.failed' },
        'Error en el pool de conexiones del migrador.',
      ),
    );
  }
  return globalThis.__inventoryMigrationPool;
}

export async function transaction(work, pool = getPool(), { readOnly = false } = {}) {
  const connection = await pool.connect();
  const state = { discard: false };
  try {
    await connection.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await work(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
    } catch (rollbackError) {
      state.discard = true;
      getLogger().warn(
        { err: rollbackError, event: 'database.transaction.rollback_failed' },
        'Se descarta la conexión tras fallar la reversión de la transacción.',
      );
    }
    throw error;
  } finally {
    connection.release(state.discard);
  }
}

export const jsonValue = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

export function insertRows(connection, table, columns, rows, suffix = '') {
  if (!/^[a-z_]+$/.test(table) || columns.some((column) => !/^[a-z_]+$/.test(column)))
    throw new Error('Identificador SQL inválido.');
  const values = rows
    .map(
      (row, rowIndex) =>
        `(${row.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(',')})`,
    )
    .join(',');
  return connection.query(
    `INSERT INTO ${table} (${columns.join(',')}) VALUES ${values} ${suffix}`,
    rows.flat(),
  );
}
