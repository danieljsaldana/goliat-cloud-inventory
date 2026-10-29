import files from './data/inventory.json' with { type: 'json' };
import { validateSnapshot } from '../normalization/validateSnapshot.mjs';
import { NORMALIZATION_VERSION } from '../constants.mjs';
import { SEED_SOURCE, SEED_VERSION } from '../../../seed/constants.mjs';

export function createAzureSeed(generatedAt) {
  validateSnapshot(files, { complete: true });
  return {
    files,
    metadata: {
      provider: 'azure',
      source: SEED_SOURCE,
      seedVersion: SEED_VERSION,
      normalizationVersion: NORMALIZATION_VERSION,
      generatedAt,
      complete: true,
      reports: Object.keys(files).length,
      subscriptions: files['subscriptions'].rows.length,
      resources: files['resources'].rows.length,
    },
  };
}
