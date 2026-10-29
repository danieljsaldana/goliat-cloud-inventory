import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { MIGRATION_NAME_PATTERN } from './constants.mjs';
import { MigrationError } from './errors.mjs';

export async function loadMigrations(directory = resolve(process.cwd(), 'server/migrations')) {
  // SQL incluido explícitamente en next.config.mjs y Dockerfile; no trazar todo el proyecto.
  const files = (await readdir(/* turbopackIgnore: true */ directory)).filter((name) =>
    name.endsWith('.sql'),
  );
  const migrations = [];
  for (const name of files) {
    const match = name.match(MIGRATION_NAME_PATTERN);
    if (!match || !Number.isSafeInteger(Number(match[1])))
      throw new MigrationError(`Nombre de migración inválido: ${name}.`);
    const sql = (
      await readFile(/* turbopackIgnore: true */ resolve(directory, name), 'utf8')
    ).replace(/\r\n/g, '\n');
    if (!sql.trim()) continue;
    migrations.push({
      name,
      version: Number(match[1]),
      checksum: createHash('sha256').update(sql).digest('hex'),
      sql,
    });
  }
  migrations.sort((left, right) => left.version - right.version);
  if (migrations.some(({ version }, index) => version !== index + 1))
    throw new MigrationError(
      'Las migraciones deben ser consecutivas desde 001, sin huecos ni versiones repetidas.',
    );
  return migrations;
}
