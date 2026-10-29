import { migrate, migrationStatus, assertSchemaReady } from './migrate.mjs';
import { getMigrationPool } from './db.mjs';
import { seedDatabase } from './seed/seedDatabase.mjs';
import { collectAzure } from './modules/azure/services/collectAzure.mjs';
import { initializeDatabase } from './database/initialize.mjs';
import { initializeMembers } from './members/initialize.mjs';

export async function executeCommand(command) {
  switch (command) {
    case 'init':
      return { ...(await initializeDatabase()), ...(await initializeMembers()) };
    case 'migrate':
      return { migrated: true, ...(await migrate()) };
    case 'migration-status':
      return migrationStatus(getMigrationPool());
    case 'schema-check':
      await assertSchemaReady();
      return { ready: true };
    case 'seed':
      await assertSchemaReady();
      return seedDatabase();
    case 'azure':
      await assertSchemaReady();
      return collectAzure();
    default:
      throw new Error(
        'Uso: node server/cli.mjs init|migrate|migration-status|schema-check|seed|azure',
      );
  }
}
