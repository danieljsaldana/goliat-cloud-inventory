import { azureStorageClient } from './storageClient.mjs';
import { azureStorageConfig } from './storageConfig.mjs';
import { STORAGE_TIMEOUT_MS } from '../documentConstants.mjs';
import { readAzureBody } from './readBody.mjs';
import { parseAzureDocument } from '../normalization/parseDocument.mjs';

export async function readAzureSnapshot({
  env = process.env,
  client = azureStorageClient(env),
  signal,
  expectedEtag,
} = {}) {
  const { container, blob, maxBytes } = azureStorageConfig(env);
  const target = client.getContainerClient(container).getBlobClient(blob);
  const timeout = AbortSignal.timeout(STORAGE_TIMEOUT_MS);
  const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const properties = await target.getProperties({ abortSignal });
  if (expectedEtag && properties.etag !== expectedEtag)
    throw new Error('El inventario publicado ha cambiado. Vuelve a solicitar la actualización.');
  if (
    !properties.etag ||
    !Number.isFinite(properties.contentLength) ||
    properties.contentLength > maxBytes
  ) {
    throw new Error('El blob Azure no tiene propiedades válidas o supera el tamaño permitido.');
  }
  const response = await target.download(0, undefined, {
    abortSignal,
    conditions: { ifMatch: properties.etag },
  });
  const document = parseAzureDocument(
    await readAzureBody(response.readableStreamBody, maxBytes, abortSignal),
    maxBytes,
  );
  return {
    ...document.snapshot,
    generatedAt: document.generatedAt,
    storage: {
      accountUrl: client.url,
      container,
      blob,
      etag: properties.etag,
      schemaVersion: document.schemaVersion,
    },
  };
}
