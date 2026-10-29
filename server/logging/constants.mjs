export const LOG_LEVELS = { info: 30, warn: 40, error: 50 };
export const LEVEL_LABELS = { info: 'información', warn: 'advertencia', error: 'error' };
export const SLOW_REQUEST_MS = 1000;
export const COMMAND_LABELS = {
  init: 'inicialización de la base de datos',
  migrate: 'migración de la base de datos',
  'migration-status': 'consulta de migraciones',
  'schema-check': 'comprobación del esquema',
  seed: 'carga de datos de prueba',
  azure: 'ingesta de Azure Storage',
};
export const REDACTED_PATHS = [
  'headers',
  'body',
  'payload',
  'req',
  'res',
  ...[
    'password',
    'secret',
    'token',
    'authorization',
    'cookie',
    'clientSecret',
    'connectionString',
  ].flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
  'env',
];
