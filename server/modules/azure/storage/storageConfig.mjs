import { required, integer } from '../../../config.mjs';

export function azureStorageConfig(env = process.env) {
  return {
    container: required('AZURE_STORAGE_CONTAINER', env),
    blob: env.AZURE_STORAGE_BLOB?.trim() || 'azure/latest.json',
    maxBytes: integer(env.AZURE_MAX_OBJECT_MB, 64, 1024) * 1024 * 1024,
  };
}
