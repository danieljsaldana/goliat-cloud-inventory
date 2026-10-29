import { closePool } from './db.mjs';
import { executeCommand } from './commands.mjs';
import { ConfigurationError } from './config.mjs';
import { loadLocalEnv } from './load-env.mjs';
import { MigrationError } from './database/errors.mjs';
import { SeedError } from './seed/errors.mjs';
import { loggedOperation } from './logging/operation.mjs';
import { flushLogs } from './logging/logger.mjs';
import { COMMAND_LABELS } from './logging/constants.mjs';

try {
  loadLocalEnv();
  const [command] = process.argv.slice(2);
  const knownCommand = Object.hasOwn(COMMAND_LABELS, command);
  const result = await loggedOperation(
    {
      operation: 'backend.command',
      label: knownCommand ? COMMAND_LABELS[command] : 'comando desconocido',
      fields: { command: knownCommand ? command : 'desconocido' },
    },
    () => executeCommand(command),
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    'Operación fallida:',
    error instanceof ConfigurationError ||
      error instanceof MigrationError ||
      error instanceof SeedError
      ? error.message
      : error.code || error.name,
  );
  process.exitCode = 1;
} finally {
  try {
    await closePool();
  } finally {
    await flushLogs();
  }
}
