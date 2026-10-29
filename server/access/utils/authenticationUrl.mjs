import { AuthConfigurationError } from '../errors.mjs';

export function authenticationUrl(value) {
  try {
    return new URL(value);
  } catch {
    throw new AuthConfigurationError('AUTH_URL debe ser una URL pública válida.');
  }
}
