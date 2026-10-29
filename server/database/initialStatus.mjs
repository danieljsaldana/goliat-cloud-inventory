import { loadInitialSchema } from './utils/loadInitialSchema.mjs';

export async function initialSchemaStatus(pool) {
  const {
    rows: [schema],
  } = await pool.query("SELECT to_regclass('inventory_schema') AS name");
  if (!schema.name) return { ready: false, initialized: false };
  const {
    rows: [state],
  } = await pool.query(`
    SELECT version, checksum,
      to_regclass('inventory_runs') IS NOT NULL AND
      to_regclass('inventory_reports') IS NOT NULL AND
      to_regclass('inventory_rows') IS NOT NULL AND
      to_regclass('inventory_heads') IS NOT NULL AS tables_present
    FROM inventory_schema WHERE singleton = TRUE
  `);
  const initial = await loadInitialSchema();
  return {
    ready: Boolean(
      state &&
      state.version === initial.version &&
      state.checksum === initial.checksum &&
      state.tables_present,
    ),
    initialized: true,
    version: state?.version,
  };
}
