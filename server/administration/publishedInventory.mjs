import { azureStorageClient } from '../modules/azure/storage/storageClient.mjs';
import { azureStorageConfig } from '../modules/azure/storage/storageConfig.mjs';

export async function publishedInventory({ env = process.env, signal, client } = {}) {
  const { container, blob } = azureStorageConfig(env);
  client ||= azureStorageClient(env);
  const timeout = AbortSignal.timeout(30000);
  const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const properties = await client
    .getContainerClient(container)
    .getBlobClient(blob)
    .getProperties({ abortSignal });
  const count = Number(properties.metadata?.resources);
  const endpoint = client.url ? new URL(client.url).origin : null;
  return {
    generatedAt: properties.metadata?.generatedat || null,
    lastModified: properties.lastModified?.toISOString() || null,
    resources: Number.isFinite(count) ? count : null,
    bytes: properties.contentLength,
    etag: properties.etag,
    storage: {
      endpoint,
      container,
      blob,
      tier: properties.accessTier || null,
      contentType: properties.contentType || null,
      encrypted:
        typeof properties.isServerEncrypted === 'boolean' ? properties.isServerEncrypted : null,
    },
  };
}
