import { readFile, writeFile } from 'node:fs/promises';
import services from '../src/core/inventory/reports/service-reports.json' with { type: 'json' };
import {
  DOCUMENT_SCHEMA_VERSION,
  RAW_REPORT_IDS,
} from '../server/modules/azure/documentConstants.mjs';

const seedPath = 'server/modules/azure/seed/data/inventory.json';
const seed = JSON.parse(await readFile(seedPath, 'utf8'));
const previous = JSON.parse(await readFile('functions/src/inventory/contract.json', 'utf8'));
const contract = {
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  reports: RAW_REPORT_IDS.map((id) => ({
    id,
    headers:
      services.find((service) => service.id === id)?.headers ||
      previous.reports.find((report) => report.id === id)?.headers ||
      seed[id].headers,
  })),
  services: services.map(({ id, types, kindContains }) => ({
    id,
    types,
    ...(kindContains ? { kindContains } : {}),
  })),
};
await writeFile('functions/src/inventory/contract.json', `${JSON.stringify(contract, null, 2)}\n`);
console.log(`Contrato sincronizado: ${contract.reports.length} informes brutos.`);
