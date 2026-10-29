import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { localConfig } from './localConfig.mjs';
import { loadConfig } from '../src/config.mjs';
import { credential } from '../src/azure/credentials.mjs';
import { armClient } from '../src/azure/arm.mjs';
import { collectAzure } from '../src/azure/collect.mjs';
import { buildDocument } from '../src/inventory/build.mjs';
import { validateDocument } from '../src/inventory/validate.mjs';

await localConfig();
const { values } = parseArgs({
  options: { output: { type: 'string', default: 'azure-inventory.local.json' } },
});
const config = loadConfig();
const snapshot = await collectAzure(
  armClient(credential()),
  config,
  AbortSignal.timeout(config.timeoutMs),
);
const bytes = validateDocument(buildDocument(snapshot, config.tagKeys), config.maxBytes);
await writeFile(values.output, bytes);
console.log(`Inventario validado guardado en ${values.output}; no se ha publicado en Storage.`);
