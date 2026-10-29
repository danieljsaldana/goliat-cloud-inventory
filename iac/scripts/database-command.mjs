import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { databaseConfig } from '../../server/config.mjs';
import { initializeDatabase } from '../../server/database/initialize.mjs';
import { assertSchemaReady } from '../../server/database/status.mjs';
import { initializeMembers } from '../../server/members/initialize.mjs';
import { MigrationError } from '../../server/database/errors.mjs';

const [command, settingsPath, outputsPath] = process.argv.slice(2);
if (!['init', 'check'].includes(command) || !settingsPath || !outputsPath)
  throw new Error('Uso: database-command.mjs init|check <config> <outputs>');
const settings = JSON.parse((await readFile(settingsPath, 'utf8')).replace(/^\uFEFF/, ''));
const outputs = JSON.parse((await readFile(outputsPath, 'utf8')).replace(/^\uFEFF/, ''));
const pool = new pg.Pool(
  databaseConfig({
    DB_HOST: outputs.databaseHost || settings.database.host,
    DB_PORT: String(settings.database.port),
    DB_NAME: settings.database.name,
    DB_USER: settings.database.username,
    DB_PASSWORD: settings.database.password,
    DB_SSL: 'true',
    DB_POOL_SIZE: '1',
  }),
);
try {
  for (const attempt of Array.from({ length: 12 }).keys()) {
    try {
      const result =
        command === 'init' ? await initializeDatabase(pool) : await assertSchemaReady(pool);
      if (command === 'init') await initializeMembers(pool);
      console.log(
        JSON.stringify({
          ready: result.ready,
          initialized: result.initialized,
          initialSchema: result.initialSchema,
        }),
      );
      break;
    } catch (error) {
      if (
        attempt === 11 ||
        !['ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'ECONNRESET', '28000'].includes(error.code)
      )
        throw error;
      console.log('Esperando conectividad de PostgreSQL tras actualizar el firewall…');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
} catch (error) {
  console.error(
    `PostgreSQL: ${error instanceof MigrationError ? error.message : error.code || error.name}`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
