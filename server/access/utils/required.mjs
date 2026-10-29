import { AuthConfigurationError } from '../errors.mjs';

export function required(name, env) {
  if (!env[name]?.trim()) throw new AuthConfigurationError(`Falta configurar ${name}.`);
  return env[name].trim();
}
