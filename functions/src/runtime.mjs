import { loadConfig } from './config.mjs';
import { credential } from './azure/credentials.mjs';
import { armClient } from './azure/arm.mjs';
import { collectAzure } from './azure/collect.mjs';
import { buildDocument } from './inventory/build.mjs';
import { storageClient } from './storage/client.mjs';
import { inventoryService } from './services/inventory.mjs';
import { authorize } from './http/authorize.mjs';
import { httpHandlers } from './http/handlers.mjs';

export function runtime() {
  const config = loadConfig();
  const identity = credential();
  const arm = armClient(identity);
  const store = storageClient(config, identity);
  const generate = async (signal) =>
    buildDocument(await collectAzure(arm, config, signal), config.tagKeys);
  const service = inventoryService(config, store, generate);
  return {
    config,
    service,
    handlers: httpHandlers(
      service,
      (request, action) => authorize(request, config, action),
      config.maxBytes,
    ),
  };
}
