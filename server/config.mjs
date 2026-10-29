import { readFileSync } from 'node:fs';

export class ConfigurationError extends Error {}

export function required(name, env = process.env) {
  if (!env[name]?.trim()) throw new ConfigurationError(`Falta configurar ${name}.`);
  return env[name].trim();
}

export function integer(value, fallback, maximum = 1000) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!/^\d+$/.test(String(value)) || Number(value) > maximum || Number(value) < 1)
    throw new ConfigurationError('Valor numérico fuera de rango.');
  return Number(value);
}

export function databaseConfig(env = process.env) {
  const sslEnabled = env.DB_SSL !== 'false';
  if (env.DB_SSL && !['true', 'false'].includes(env.DB_SSL))
    throw new ConfigurationError('DB_SSL debe ser true o false.');
  return {
    host: required('DB_HOST', env),
    port: integer(env.DB_PORT, 5432, 65535),
    user: required('DB_USER', env),
    password: env.DB_PASSWORD || '',
    database: required('DB_NAME', env),
    ssl: sslEnabled
      ? {
          ...(env.DB_SSL_CA_PATH?.trim()
            ? { ca: readFileSync(env.DB_SSL_CA_PATH.trim(), 'utf8') }
            : {}),
          rejectUnauthorized: true,
        }
      : undefined,
    max: integer(env.DB_POOL_SIZE, 5, 100),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: integer(env.DB_QUERY_TIMEOUT_MS, 60000, 3600000),
    application_name: env.DB_APPLICATION_NAME || 'goliat-cloud-inventory',
  };
}

export function migrationDatabaseConfig(env = process.env) {
  return {
    ...databaseConfig({
      ...env,
      DB_HOST: env.DB_MIGRATION_HOST || env.DB_HOST,
      DB_USER: env.DB_MIGRATION_USER || env.DB_USER,
      DB_PASSWORD: env.DB_MIGRATION_PASSWORD || env.DB_PASSWORD,
    }),
    max: 1,
    application_name: 'cloud-inventory-migrator',
  };
}
