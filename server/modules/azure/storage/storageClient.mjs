import { BlobServiceClient } from '@azure/storage-blob';
import { azureCredential } from './credential.mjs';
import { required, ConfigurationError } from '../../../config.mjs';

export function azureStorageClient(env = process.env) {
  const url = new URL(required('AZURE_STORAGE_ACCOUNT_URL', env));
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new ConfigurationError(
      'AZURE_STORAGE_ACCOUNT_URL debe ser el endpoint HTTPS de Blob Storage, sin credenciales ni rutas.',
    );
  }
  return new BlobServiceClient(url.origin, azureCredential(env));
}
