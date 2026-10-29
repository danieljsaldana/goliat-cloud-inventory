import { getPool, transaction } from '../db.mjs';

export async function databaseAdministration({ env = process.env, signal, pool } = {}) {
  signal?.throwIfAborted();
  const result = await transaction(
    async (connection) => {
      await connection.query("SET LOCAL statement_timeout = '10s'");
      return connection.query({
        text: `SELECT current_database() AS name,
          current_setting('server_version') AS version,
          pg_database_size(current_database())::text AS bytes,
          (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls,
          (SELECT COUNT(*)::text FROM inventory_reports r
            JOIN inventory_heads h ON h.run_id = r.run_id WHERE h.provider = 'azure') AS reports,
          (SELECT COUNT(*)::text FROM inventory_rows r
            JOIN inventory_heads h ON h.run_id = r.run_id WHERE h.provider = 'azure') AS rows`,
        query_timeout: 10000,
      });
    },
    pool || getPool(),
    { readOnly: true },
  );
  signal?.throwIfAborted();
  const row = result.rows[0];
  return {
    name: row.name,
    host: env.DB_HOST?.trim() || null,
    port: Number(env.DB_PORT || 5432),
    version: row.version,
    bytes: Number(row.bytes),
    tls: typeof row.tls === 'boolean' ? row.tls : null,
    reports: Number(row.reports),
    rows: Number(row.rows),
  };
}
