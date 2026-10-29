import { transaction } from '../db.mjs';
import {
  lockAzureSeedTables,
  hasForeignAzureSeed,
  publishAzureSeed,
} from '../modules/azure/repositories/seed.mjs';
import { SeedError } from './errors.mjs';

export async function writeSeed(seed, pool) {
  return transaction(async (connection) => {
    // Serializa la comprobación y la escritura, también frente a los colectores.
    await lockAzureSeedTables(connection);
    const foreignAzure = await hasForeignAzureSeed(connection);
    if (foreignAzure) {
      throw new SeedError(
        'La semilla requiere una base vacía o con esta misma semilla. No se han modificado datos.',
      );
    }
    const azure = await publishAzureSeed(connection, seed.files, seed.metadata);
    return { azure };
  }, pool);
}
