import { app } from '@azure/functions';
import { QUEUE_NAME, RETRIES } from './config.mjs';
import { runtime } from './runtime.mjs';

app.setup({ enableHttpStream: false });

for (const [name, route, method, handler] of [
  ['inventoryGenerate', 'inventory/generate', 'POST', 'generate'],
  ['inventoryStatus', 'inventory/operations/{operationId}', 'GET', 'status'],
  ['inventoryPublish', 'inventory/publish', 'POST', 'publish'],
]) {
  app.http(name, {
    route,
    methods: [method],
    authLevel: 'anonymous',
    handler: async (request, context) => {
      try {
        return await runtime().handlers[handler](request, context);
      } catch {
        context.error('inventory.configuration.failed');
        return {
          status: 503,
          jsonBody: { error: 'Configura el productor antes de utilizar HTTP.' },
        };
      }
    },
  });
}

app.timer('inventoryTimer', {
  schedule: '%INVENTORY_SCHEDULE%',
  runOnStartup: false,
  useMonitor: true,
  handler: async (_timer, context) => {
    const id = await runtime().service.requestGeneration();
    context.log('inventory.queued', { operationId: id });
  },
});

app.storageQueue('inventoryWorker', {
  queueName: QUEUE_NAME,
  connection: 'AzureWebJobsStorage',
  handler: async (message, context) => {
    const job = typeof message === 'string' ? JSON.parse(message) : message;
    try {
      const result = await runtime().service.run(
        job,
        Number(context.triggerMetadata.dequeueCount || 1),
      );
      context.log('inventory.published', {
        operationId: result.operationId,
        resources: result.resources,
      });
    } catch {
      context.error('inventory.generation.failed', {
        operationId: job?.operationId,
        maxAttempts: RETRIES,
      });
      throw new Error('Generación fallida; reintentar desde la cola.');
    }
  },
});

app.storageQueue('inventoryPoison', {
  queueName: `${QUEUE_NAME}-poison`,
  connection: 'AzureWebJobsStorage',
  handler: async (message) => {
    await runtime().service.fail(typeof message === 'string' ? JSON.parse(message) : message);
  },
});
