import { readFile, writeFile } from 'node:fs/promises';
import {
  DOCUMENT_SCHEMA_VERSION,
  RAW_REPORT_IDS,
} from '../server/modules/azure/documentConstants.mjs';
import { REPORTS } from '../src/core/inventory/reports.js';
import { parseAzureDocument } from '../server/modules/azure/normalization/parseDocument.mjs';
import { normalizeAzureSnapshot } from '../server/modules/azure/normalization/normalizeSnapshot.mjs';

const examples = JSON.parse(
  await readFile('server/modules/azure/seed/data/inventory.json', 'utf8'),
);
const subscriptionId = '11111111-1111-4111-8111-111111111111';
const tagKeys = ['environment'];
const document = {
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  provider: 'azure',
  generatedAt: '2026-10-10T08:00:00.000Z',
  snapshot: {
    catalog: [{ subscriptionId, subscriptionName: 'Desarrollo', state: 'Enabled' }],
    tagKeys,
    reports: RAW_REPORT_IDS.map((id) => ({
      id,
      headers: examples[id].headers
        .filter((header) => !header.startsWith('tag_'))
        .flatMap((header) =>
          header === 'tags_json' ? [...tagKeys.map((key) => `tag_${key}`), header] : [header],
        ),
      rows: [],
    })),
    totals: [{ subscriptionId, resources: 0, distinctTypes: 0 }],
    tags: [],
  },
};
const bytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
const validated = parseAzureDocument(bytes, 64 * 1024 * 1024);
const normalized = normalizeAzureSnapshot(validated.snapshot, validated.generatedAt);
if (Object.keys(normalized.files).length !== REPORTS.length)
  throw new Error('Snapshot incompleto.');
await writeFile('docs/azure-inventory.example.json', bytes);
console.log(
  `Ejemplo validado: ${RAW_REPORT_IDS.length} informes brutos, ${REPORTS.length} vistas normalizadas.`,
);
