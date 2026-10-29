export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const QUEUE_NAME = 'goliat-inventory';
export const RETRIES = 5;

export function splitList(value = '') {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadConfig(env = process.env) {
  const subscriptionIds = splitList(env.INVENTORY_SUBSCRIPTION_IDS).map((id) => id.toLowerCase());
  if (
    !subscriptionIds.length ||
    subscriptionIds.some((id) => !UUID.test(id)) ||
    new Set(subscriptionIds).size !== subscriptionIds.length
  ) {
    throw new Error('Configura INVENTORY_SUBSCRIPTION_IDS con IDs de suscripción únicos.');
  }
  const endpoint = new URL(env.AZURE_STORAGE_ACCOUNT_URL || '');
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/' ||
    !endpoint.hostname.endsWith('.blob.core.windows.net')
  ) {
    throw new Error(
      'Configura un endpoint de Blob Storage de Azure público, sin rutas ni credenciales.',
    );
  }
  const container = env.AZURE_STORAGE_CONTAINER || 'cloud-inventory';
  const blob = env.AZURE_STORAGE_BLOB || 'azure/latest.json';
  if (
    !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(container) ||
    container.includes('--') ||
    !blob ||
    blob.startsWith('_control/') ||
    blob.startsWith('_operations/')
  ) {
    throw new Error('Destino de inventario inválido.');
  }
  const maxMB = Number(env.AZURE_MAX_OBJECT_MB || 64);
  const timeoutMs = Number(env.INVENTORY_TIMEOUT_MS || 840000);
  if (
    !Number.isInteger(maxMB) ||
    maxMB < 1 ||
    maxMB > 64 ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > 840000
  ) {
    throw new Error('Límite de documento o timeout inválido.');
  }
  const tagKeys = splitList(env.INVENTORY_TAG_KEYS);
  if (
    new Set(tagKeys.map((key) => key.toLowerCase())).size !== tagKeys.length ||
    tagKeys.some((key) => /[\r\n]/.test(key))
  )
    throw new Error('Etiquetas configuradas inválidas.');
  return {
    subscriptionIds,
    tagKeys,
    endpoint: endpoint.href,
    container,
    blob,
    queueEndpoint: endpoint.href.replace('.blob.', '.queue.'),
    queueConnectionString: env.AzureWebJobsStorage || '',
    maxBytes: maxMB * 1024 * 1024,
    timeoutMs,
    tenantId: (env.AZURE_TENANT_ID || '').toLowerCase(),
    audience: (env.FUNCTION_API_AUDIENCE || '').toLowerCase(),
    allowedClients: splitList(env.FUNCTION_ALLOWED_CLIENT_IDS).map((id) => id.toLowerCase()),
  };
}
