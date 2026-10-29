import { publishInventorySnapshot } from './publishInventorySnapshot.mjs';
import { SEED_SOURCE, SEED_VERSION } from '../../../seed/constants.mjs';

export async function lockAzureSeedTables(connection) {
  await connection.query('LOCK TABLE inventory_runs IN SHARE ROW EXCLUSIVE MODE');
}

export async function hasForeignAzureSeed(connection) {
  const {
    rows: [state],
  } = await connection.query(
    `SELECT EXISTS (SELECT 1 FROM inventory_runs
      WHERE metadata->>'source' IS DISTINCT FROM $1
        OR metadata->>'seedVersion' IS DISTINCT FROM $2) AS foreign_inventory`,
    [SEED_SOURCE, String(SEED_VERSION)],
  );
  return state.foreign_inventory;
}

export async function publishAzureSeed(connection, files, metadata) {
  const {
    rows: [head],
  } = await connection.query(
    `SELECT r.id, r.generated_at FROM inventory_heads h
     JOIN inventory_runs r ON r.id = h.run_id WHERE h.provider = 'azure'`,
  );
  if (head) {
    return {
      runId: head.id,
      generatedAt: head.generated_at.toISOString(),
      reports: Object.keys(files).length,
      skipped: true,
    };
  }
  return { ...(await publishInventorySnapshot(connection, files, metadata)), skipped: false };
}
