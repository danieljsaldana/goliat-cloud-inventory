import { getPool } from '../../../db.mjs';
import { REPORTS } from '../../../../src/core/inventory/reports.js';
import { validateSnapshot } from '../normalization/validateSnapshot.mjs';
import { NORMALIZATION_VERSION } from '../constants.mjs';
import { writeInventorySnapshot, readInventorySnapshot } from '../repositories/inventory.mjs';
export async function saveInventory(files, metadata = {}, pool = getPool()) {
  validateSnapshot(files);
  return writeInventorySnapshot(
    files,
    { ...metadata, normalizationVersion: NORMALIZATION_VERSION },
    pool,
  );
}
export async function getInventory(pool = getPool()) {
  const snapshot = await readInventorySnapshot(pool);
  if (!snapshot.metadata) return snapshot;
  return {
    ...snapshot,
    errors: REPORTS.filter(({ id }) => !snapshot.files[id]).map(({ id }) => ({
      id,
      code: 'http',
      status: 404,
    })),
  };
}
