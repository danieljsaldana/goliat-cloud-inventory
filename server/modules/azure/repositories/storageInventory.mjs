import { getPool, transaction } from '../../../db.mjs';
import { publishInventorySnapshot } from './publishInventorySnapshot.mjs';
import { validateSnapshot } from '../normalization/validateSnapshot.mjs';

export async function saveStorageInventory(files, metadata, pool = getPool()) {
  validateSnapshot(files, { complete: true });
  return transaction(async (connection) => {
    await connection.query("SELECT pg_advisory_xact_lock(hashtext('azure-storage-inventory'))");
    const {
      rows: [current],
    } = await connection.query(
      `SELECT r.id, r.metadata FROM inventory_heads h JOIN inventory_runs r ON r.id = h.run_id
       WHERE h.provider = 'azure'`,
    );
    const previous = current?.metadata;
    const sameLocation =
      previous?.storage &&
      metadata.storage &&
      ['accountUrl', 'container', 'blob'].every(
        (key) => previous.storage[key] === metadata.storage[key],
      );
    if (
      sameLocation &&
      (previous.storage.etag === metadata.storage.etag ||
        Date.parse(previous.generatedAt) > Date.parse(metadata.generatedAt))
    ) {
      return { runId: current.id, skipped: true };
    }
    return { ...(await publishInventorySnapshot(connection, files, metadata)), skipped: false };
  }, pool);
}
