import { ConfigurationError } from '../../config.mjs';

export function booleanSetting(name, fallback, env) {
  const value = env[name]?.trim();
  if (value === undefined || value === '') return fallback;
  if (!['true', 'false'].includes(value))
    throw new ConfigurationError(`${name} debe ser true o false.`);
  return value === 'true';
}
