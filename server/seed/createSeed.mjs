import { createAzureSeed } from '../modules/azure/seed/createSeed.mjs';

export function createSeed(generatedAt = new Date().toISOString()) {
  return createAzureSeed(generatedAt);
}
