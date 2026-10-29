import test from 'node:test';
import assert from 'node:assert/strict';
import { records } from '../src/core/table/index.js';
import { REPORTS } from '../src/core/inventory/reports.js';
import serviceReports from '../src/core/inventory/reports/service-reports.json' with { type: 'json' };
import files from '../server/modules/azure/seed/data/inventory.json' with { type: 'json' };
import { getOverviewData } from '../src/core/inventory/overview.js';
import { scopeInventory } from '../src/core/inventory/subscriptions.js';
import { validateSnapshot } from '../server/modules/azure/normalization/validateSnapshot.mjs';
const rows = (files, id) => records(files[id]);
const total = (source, column = 'resources') =>
  source.reduce((sum, row) => sum + Number(row[column]), 0);
test('la semilla Azure cubre todas las vistas, tipos y relaciones sin alterar los totales', () => {
  validateSnapshot(files, { complete: true });
  assert.deepEqual(Object.keys(files).sort(), REPORTS.map((report) => report.id).sort());
  const newServices = serviceReports.filter((report) => report.headers);
  for (const [id, file] of Object.entries(files))
    if (!newServices.some((report) => report.id === id)) assert.ok(file.rows.length, id);
  const detail = rows(files, 'resources');
  assert.equal(new Set(detail.map((row) => row.id)).size, detail.length);
  const overview = getOverviewData(files);
  assert.equal(overview.total, detail.length);
  assert.equal(overview.providerCount, new Set(detail.map((row) => row.type.split('/')[0])).size);
  assert.equal(
    overview.providers.reduce((sum, [, count]) => sum + count, 0),
    detail.length,
  );
  for (const file of Object.values(files)) {
    assert.ok(
      !file.headers.some((header) => ['infra', 'infraResources', 'category'].includes(header)),
    );
    if (file.headers.includes('type')) {
      for (const row of records(file))
        assert.equal(row.resourceProvider, row.type.split('/')[0].toLowerCase());
    }
  }
  for (const id of ['tags-by-subscription', 'tags']) {
    for (const row of rows(files, id)) {
      const count = row.resourceProviders
        .split('; ')
        .reduce((sum, entry) => sum + Number(entry.split('=')[1]), 0);
      assert.equal(count, Number(row.resources));
    }
  }
  assert.equal(total(rows(files, 'resource-types')), detail.length);
  assert.equal(total(rows(files, 'tags-by-subscription')), detail.length);
  assert.equal(total(rows(files, 'tags')), detail.length);
  assert.equal(total(rows(files, 'resource-groups')), detail.length);
  assert.equal(rows(files, 'virtual-machines').length, 105);
  const ids = new Set(detail.map((row) => row.id));
  for (const descriptor of serviceReports) {
    const reportRows = rows(files, descriptor.id);
    for (const type of descriptor.headers ? [] : descriptor.types) {
      assert.ok(
        reportRows.some((row) => row.type === type),
        `${descriptor.id}: ${type}`,
      );
    }
    if (descriptor.headers) {
      assert.deepEqual(
        reportRows.map((row) => row.id).sort(),
        detail
          .filter(
            (row) =>
              descriptor.types.includes(row.type) &&
              (!descriptor.kindContains ||
                row.kind.toLowerCase().includes(descriptor.kindContains)),
          )
          .map((row) => row.id)
          .sort(),
        descriptor.id,
      );
    }
    for (const row of reportRows) {
      if (row.type === 'microsoft.automation/automationaccounts/webhooks') {
        assert.ok(ids.has(row.parentId));
        assert.ok(!ids.has(row.id), 'El hijo ARM no se duplica en los totales ARG');
      } else assert.ok(ids.has(row.id), row.id);
    }
  }
  for (const row of rows(files, 'sql-databases')) assert.ok(ids.has(row.serverId));
  for (const row of rows(files, 'runbooks')) assert.ok(ids.has(row.automationAccountId));
  assert.deepEqual(
    new Set(rows(files, 'managed-redis').map((row) => row.serviceType)),
    new Set(['Azure Managed Redis', 'Azure Cache for Redis Enterprise']),
  );
  const logicApps = rows(files, 'logic-apps');
  const functions = rows(files, 'functions');
  assert.ok(logicApps.some((row) => row.appType === 'Logic App Consumption'));
  assert.ok(logicApps.some((row) => row.appType === 'Logic App Standard'));
  assert.ok(functions.every((row) => !row.kind.includes('workflowapp')));
  assert.ok(!functions.some((row) => logicApps.some((app) => app.id === row.id)));
  const subnets = rows(files, 'subnets');
  for (const subnet of subnets) {
    assert.ok(ids.has(subnet.networkSecurityGroupId));
    assert.ok(ids.has(subnet.routeTableId));
    if (subnet.natGatewayId) assert.ok(ids.has(subnet.natGatewayId));
  }
  for (const endpoint of rows(files, 'private-endpoints')) {
    assert.ok(subnets.some((subnet) => subnet.id === endpoint.subnetId));
    assert.ok(JSON.parse(endpoint.privateLinkServiceIds).every((id) => ids.has(id)));
    assert.ok(JSON.parse(endpoint.networkInterfaces).every(({ id }) => ids.has(id)));
  }
  for (const subscription of rows(files, 'subscriptions')) {
    const filtered = scopeInventory(files, subscription.subscriptionId);
    const expected = detail.filter(
      (row) => row.subscriptionId === subscription.subscriptionId,
    ).length;
    assert.equal(getOverviewData(filtered).total, expected);
  }
  assert.ok(
    rows(files, 'monitoring-resources').some(
      (row) => row.enabled === 'false' && row.severity === '0',
    ),
  );
});
