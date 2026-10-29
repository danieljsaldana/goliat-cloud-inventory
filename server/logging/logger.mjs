import pino from 'pino';
import { loggingConfig } from './config.mjs';
import { LEVEL_LABELS, LOG_LEVELS, REDACTED_PATHS } from './constants.mjs';
import { logContext } from './context.mjs';
import { serializeError } from './utils/serializeError.mjs';

const key = Symbol.for('cloud-inventory.logging');

export function createLogging({ env = process.env, stream } = {}) {
  const config = loggingConfig(env);
  const destination =
    stream ?? (config.enabled ? pino.destination({ dest: 2, sync: false }) : process.stderr);
  const logger = pino(
    {
      enabled: config.enabled,
      level: config.level,
      customLevels: LOG_LEVELS,
      useOnlyCustomLevels: true,
      base: { service: 'cloud-inventory', pid: process.pid },
      timestamp: pino.stdTimeFunctions.isoTime,
      messageKey: 'mensaje',
      formatters: { level: (label, level) => ({ level, nivel: LEVEL_LABELS[label] }) },
      mixin: () => ({ ...logContext.getStore() }),
      serializers: { err: serializeError, error: serializeError },
      redact: { paths: REDACTED_PATHS, censor: '[OCULTO]' },
    },
    destination,
  );
  return { config, logger };
}

export function getLogging() {
  return (globalThis[key] ??= createLogging());
}

export function getLogger() {
  return getLogging().logger;
}

export async function flushLogs() {
  const logging = globalThis[key];
  if (!logging) return;
  await new Promise((resolve, reject) => {
    logging.logger.flush((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
