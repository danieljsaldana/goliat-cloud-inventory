import { getPool } from '../db.mjs';
import { createSeed } from './createSeed.mjs';
import { SeedError } from './errors.mjs';
import { writeSeed } from './writeSeed.mjs';
import { getLogger } from '../logging/logger.mjs';

export async function seedDatabase(pool, env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new SeedError(
      'La semilla es solo para desarrollo y pruebas. NODE_ENV=production no está permitido.',
    );
  }
  const result = await writeSeed(createSeed(), pool ?? getPool());
  getLogger().info(
    { event: 'seed.completed', azureSkipped: result.azure.skipped },
    'Carga de datos de prueba completada.',
  );
  return result;
}
