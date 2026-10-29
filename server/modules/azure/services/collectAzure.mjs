import { readAzureSnapshot } from '../storage/source.mjs';
import { normalizeAzureSnapshot } from '../normalization/normalizeSnapshot.mjs';
import { saveStorageInventory } from '../repositories/storageInventory.mjs';
import { getLogger } from '../../../logging/logger.mjs';

export async function collectAzure({
  save = saveStorageInventory,
  source = readAzureSnapshot,
  normalize = normalizeAzureSnapshot,
  pool,
  ...options
} = {}) {
  options.signal?.throwIfAborted();
  const raw = await source(options);
  options.signal?.throwIfAborted();
  const snapshot = normalize(raw, raw.generatedAt || new Date().toISOString());
  options.signal?.throwIfAborted();
  const result = await save(
    snapshot.files,
    {
      ...snapshot.metadata,
      source: 'azure-storage',
      storage: raw.storage,
    },
    pool,
  );
  getLogger().info(
    {
      event: 'ingestion.completed',
      provider: 'azure',
      reports: Object.keys(snapshot.files).length,
      skipped: Boolean(result?.skipped),
    },
    'Ingesta de Azure Storage completada.',
  );
  return result;
}
