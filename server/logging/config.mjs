import { ConfigurationError } from '../config.mjs';
import { LOG_LEVELS } from './constants.mjs';
import { booleanSetting } from './utils/booleanSetting.mjs';

export function loggingConfig(env = process.env) {
  const level = env.LOG_LEVEL?.trim() || 'info';
  if (!Object.hasOwn(LOG_LEVELS, level))
    throw new ConfigurationError('LOG_LEVEL debe ser info, warn o error.');
  return {
    enabled: booleanSetting('LOG_ENABLED', true, env),
    level,
    httpEnabled: booleanSetting('LOG_HTTP_ENABLED', true, env),
  };
}
