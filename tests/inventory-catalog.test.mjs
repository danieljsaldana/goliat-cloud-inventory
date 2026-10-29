import test from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_GROUPS, REPORTS } from '../src/core/inventory/reports.js';
import services from '../src/core/inventory/reports/service-reports.json' with { type: 'json' };
import contract from '../functions/src/inventory/contract.json' with { type: 'json' };
import { PAGE_ROUTES, isPageRoute, routePath } from '../src/core/routing/paths.js';
import {
  RAW_REPORT_IDS,
  DOCUMENT_SCHEMA_VERSION,
} from '../server/modules/azure/documentConstants.mjs';
import { buildDocument } from '../functions/src/inventory/build.mjs';
import { parseAzureDocument } from '../server/modules/azure/normalization/parseDocument.mjs';
import { normalizeAzureSnapshot } from '../server/modules/azure/normalization/normalizeSnapshot.mjs';
import { snapshot, SUBSCRIPTION } from '../functions/tests/fixture.mjs';
import { translate } from '../src/core/i18n/translate.js';

test('el catálogo, las URLs y el productor comparten nombres semánticos sin alias', () => {
  assert.equal(REPORTS.length, 73);
  assert.equal(REPORT_GROUPS.length, 12);
  assert.equal(contract.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.deepEqual(
    contract.reports.map(({ id }) => id),
    RAW_REPORT_IDS,
  );
  for (const report of REPORTS) {
    assert.match(report.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(PAGE_ROUTES.some((route) => route.join('/') === `inventario/${report.id}`));
    for (const locale of ['es', 'en'])
      assert.equal(
        routePath(['inventario', report.id], locale),
        `${locale}/inventario/${report.id}/`,
      );
  }
  assert.equal(isPageRoute(['inventario', '48_functions']), false);
  assert.equal(isPageRoute(['azure']), false);
  for (const report of REPORTS) assert.equal(isPageRoute(['azure', report.id]), false);
  for (const service of services.filter(({ headers }) => headers)) {
    assert.equal(service.headers[0], 'name');
    assert.deepEqual(contract.reports.find(({ id }) => id === service.id).headers, service.headers);
    for (const locale of ['es', 'en'])
      for (const header of service.headers)
        assert.notEqual(translate(locale, `table.columns.${header}`), `table.columns.${header}`);
  }
});

test('todas las vistas nuevas reciben sus tipos, PostgreSQL mantiene detalles y OpenAI discrimina kind', () => {
  const fixture = snapshot();
  const extras = services
    .filter(({ headers }) => headers)
    .flatMap((service) =>
      service.types.map((type, index) => ({
        id: `/subscriptions/${SUBSCRIPTION}/resourceGroups/demo/providers/${type}/${service.id}-${index}`,
        subscriptionId: SUBSCRIPTION,
        resourceGroup: 'demo',
        name: `${service.id}-${index}`,
        type,
        kind: service.kindContains || '',
        location: 'westeurope',
        tags: {},
        properties: {
          version: '17',
          state: 'Ready',
          storage: { storageSizeGB: 32, autoGrow: 'Disabled' },
          backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' },
          highAvailability: { mode: 'Disabled', state: 'NotEnabled' },
          network: { publicNetworkAccess: 'Enabled' },
          fullyQualifiedDomainName: 'demo.postgres.database.azure.com',
          frontendIPConfigurations: [{}],
          backendAddressPools: [{}, {}],
          loadBalancingRules: [],
          enableAcceleratedNetworking: false,
          ipConfigurations: [],
          adminPassword: 'never-publish-this',
        },
      })),
    );
  fixture.resources.push(...extras);
  const raw = buildDocument(fixture);
  const document = parseAzureDocument(Buffer.from(JSON.stringify(raw)), 64 * 1024 * 1024);
  const { files } = normalizeAzureSnapshot(document.snapshot, document.generatedAt);
  for (const service of services.filter(({ headers }) => headers)) {
    const expected = fixture.resources.filter(
      (resource) =>
        service.types.includes(resource.type.toLowerCase()) &&
        (!service.kindContains || resource.kind?.toLowerCase().includes(service.kindContains)),
    );
    assert.equal(files[service.id].rows.length, expected.length, service.id);
  }
  const pg = raw.snapshot.reports.find(({ id }) => id === 'postgresql').rows[0];
  assert.equal(pg.storageSizeGB, 32);
  assert.equal(pg.backupRetentionDays, 7);
  assert.equal(pg.publicNetworkAccess, 'Enabled');
  const lb = raw.snapshot.reports.find(({ id }) => id === 'load-balancers').rows[0];
  assert.equal(lb.backendPoolCount, 2);
  assert.equal(lb.loadBalancingRuleCount, 0);
  assert.equal(
    raw.snapshot.reports.find(({ id }) => id === 'network-interfaces').rows[0]
      .acceleratedNetworking,
    false,
  );
  assert.ok(!JSON.stringify(raw).includes('never-publish-this'));
});

test('los documentos anteriores y las recogidas incompletas se rechazan', () => {
  const raw = buildDocument(snapshot());
  assert.throws(() =>
    parseAzureDocument(Buffer.from(JSON.stringify({ ...raw, schemaVersion: 1 })), 64 * 1024 * 1024),
  );
  raw.snapshot.reports.find(({ id }) => id === 'functions').id = '48_functions';
  assert.throws(() => parseAzureDocument(Buffer.from(JSON.stringify(raw)), 64 * 1024 * 1024));
  const incomplete = buildDocument(snapshot());
  incomplete.snapshot.reports = incomplete.snapshot.reports.filter(({ id }) => id !== 'postgresql');
  assert.throws(() =>
    parseAzureDocument(Buffer.from(JSON.stringify(incomplete)), 64 * 1024 * 1024),
  );
});
