import { ConfigurationError } from '../../config.mjs';
import { MigrationError } from '../../database/errors.mjs';
import { SeedError } from '../../seed/errors.mjs';

export function serializeError(error) {
  const type = error?.type || error?.name;
  const safe = typeof type === 'string' && /^[\w.-]{1,80}$/.test(type);
  const code = error?.code;
  const known =
    error instanceof ConfigurationError ||
    error instanceof MigrationError ||
    error instanceof SeedError;
  return {
    type: safe ? type : 'Error',
    code: typeof code === 'string' && /^[\w.-]{1,80}$/.test(code) ? code : undefined,
    detail: known ? error.message : undefined,
  };
}
