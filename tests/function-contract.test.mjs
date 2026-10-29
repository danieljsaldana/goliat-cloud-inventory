import { REPORTS } from '../src/core/inventory/reports.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocument } from '../functions/src/inventory/build.mjs';
import { validateDocument } from '../functions/src/inventory/validate.mjs';
import { snapshot } from '../functions/tests/fixture.mjs';
import { parseAzureDocument } from '../server/modules/azure/normalization/parseDocument.mjs';
import { normalizeAzureSnapshot } from '../server/modules/azure/normalization/normalizeSnapshot.mjs';
import { RAW_REPORT_IDS } from '../server/modules/azure/documentConstants.mjs';

test('el productor independiente genera el contrato real y todas las vistas con expansiones', () => {
  const raw = buildDocument(snapshot());
  assert.deepEqual(
    raw.snapshot.reports.map((r) => r.id),
    RAW_REPORT_IDS,
  );
  const document = parseAzureDocument(validateDocument(raw), 64 * 1024 * 1024);
  const normalized = normalizeAzureSnapshot(document.snapshot, document.generatedAt);
  assert.equal(Object.keys(normalized.files).length, REPORTS.length);
  const table = (id) => normalized.files[id];
  assert.equal(table('aks-node-pools').rows.length, 1);
  assert.equal(table('subnets').rows.length, 1);
  assert.equal(table('network-security-rules').rows.length, 2);
  assert.equal(
    table('aks-node-pools').rows[0][table('aks-node-pools').headers.indexOf('nodeCount')],
    '0',
  );
  assert.equal(
    table('aks-node-pools').rows[0][table('aks-node-pools').headers.indexOf('autoscaling')],
    'false',
  );
  assert.equal(
    table('private-endpoints').rows[0][
      table('private-endpoints').headers.indexOf('connectionStates')
    ],
    'Approved; Pending',
  );
});
