import { randomUUID } from 'node:crypto';
import { getLogging } from './logger.mjs';
import { logContext, withLogContext } from './context.mjs';

export async function loggedOperation({ operation, label, fields = {}, logging }, work) {
  const { logger, config } = logging ?? getLogging();
  if (!config.enabled) return work();
  const operationId = logContext.getStore()?.operationId || randomUUID();
  const started = performance.now();
  return withLogContext({ operationId, operation }, async () => {
    try {
      const result = await work();
      logger.info(
        {
          ...fields,
          event: 'operation.completed',
          durationMs: Math.round(performance.now() - started),
        },
        `Operación completada: ${label}.`,
      );
      return result;
    } catch (err) {
      logger.error(
        {
          ...fields,
          err,
          event: 'operation.failed',
          durationMs: Math.round(performance.now() - started),
        },
        `Operación fallida: ${label}.`,
      );
      throw err;
    }
  });
}
