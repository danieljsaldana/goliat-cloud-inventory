import { ConfigurationError } from '../../config.mjs';
import { REFRESH_LOCK_KEYS } from '../constants.mjs';

export function lockKey(provider) {
  if (!Object.hasOwn(REFRESH_LOCK_KEYS, provider)) {
    throw new ConfigurationError('Proveedor de actualización inválido.');
  }
  return REFRESH_LOCK_KEYS[provider];
}
