import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_SUMMARIES,
  getCategoryOverview,
  resourceInCategory,
  resourceTags,
  tagValue,
  countResources,
} from '../src/core/inventory/categories.js';
import { scopeInventory } from '../src/core/inventory/subscriptions.js';
import { REPORT_GROUPS } from '../src/core/inventory/reports.js';
import { isPageRoute, parsePagePath, routePath } from '../src/core/routing/paths.js';
import { translate } from '../src/core/i18n/translate.js';
import { getPageMetadata } from '../src/core/sharing/metadata.js';
import { searchInventory } from '../src/core/inventory/search.js';
import seed from '../server/modules/azure/seed/data/inventory.json' with { type: 'json' };

const file = (rows) => ({
  headers: [
    'id',
    'name',
    'type',
    'subscriptionId',
    'subscriptionName',
    'resourceGroup',
    'location',
    'tags_json',
    'kind',
  ],
  rows,
});
const vm = [
  '/subscriptions/one/vm/first',
  'first',
  'microsoft.compute/virtualmachines',
  'one',
  'One',
  'shared-name',
  'westeurope',
  '{}',
  '',
];

test('the eleven category summaries have valid localized routes, metadata and search entries', () => {
  assert.equal(CATEGORY_SUMMARIES.length, 11);
  assert.deepEqual(
    CATEGORY_SUMMARIES.map(({ group }) => group),
    REPORT_GROUPS.filter(({ id }) => id !== 'inventory').map(({ id }) => id),
  );
  for (const summary of CATEGORY_SUMMARIES) {
    const route = ['inventario', summary.id];
    assert.ok(isPageRoute(route));
    for (const locale of ['es', 'en']) {
      const path = `/${routePath(route, locale)}`;
      assert.deepEqual(parsePagePath(path), { locale, route });
      const title = translate(locale, summary.labelKey);
      assert.notEqual(title, summary.labelKey);
      assert.ok(getPageMetadata(route, locale).title.includes(title));
      const search = searchInventory([], seed, title, (key) => translate(locale, key));
      assert.ok(
        search.groups
          .find(({ kind }) => kind === 'reports')
          .items.some(({ id }) => id === summary.id),
      );
    }
  }
});

test('unique ARM resources are counted once despite overlapping reports and mixed-case IDs', () => {
  const duplicate = [...vm];
  duplicate[0] = duplicate[0].toUpperCase();
  const files = {
    resources: file([vm, duplicate]),
    'virtual-machines': file([vm, duplicate]),
    'virtual-machine-summary': { headers: ['vms'], rows: [['500']] },
  };
  const data = getCategoryOverview(files, 'compute');
  assert.equal(data.rows.length, 1);
  assert.deepEqual(data.types, [['microsoft.compute/virtualmachines', 1]]);
  assert.equal(data.subscriptionEntries[0][1], 1);
  assert.equal(files.resources.rows.length, 2);
});

test('category membership keeps managed disks in storage and workflow apps in integration', () => {
  assert.ok(resourceInCategory({ type: 'Microsoft.Compute/disks' }, 'storage'));
  assert.equal(resourceInCategory({ type: 'microsoft.compute/disks' }, 'compute'), false);
  const workflow = { type: 'Microsoft.Web/sites', kind: 'functionapp,workflowapp' };
  assert.ok(resourceInCategory(workflow, 'integration'));
  assert.equal(resourceInCategory(workflow, 'web'), false);
  assert.ok(resourceInCategory({ type: workflow.type, kind: 'functionapp' }, 'web'));
  assert.ok(resourceInCategory({ type: 'microsoft.sql/servers/databases' }, 'databases'));
});

test('empty inventory, unavailable reports and partial detail fallback stay distinct', () => {
  assert.equal(getCategoryOverview({}, 'compute').hasData, false);
  const empty = getCategoryOverview({ resources: file([]) }, 'compute');
  assert.equal(empty.hasData, true);
  assert.equal(empty.rows.length, 0);
  const partial = getCategoryOverview({ 'virtual-machines': file([vm]) }, 'compute');
  assert.equal(partial.hasData, true);
  assert.equal(partial.partial, true);
  assert.equal(partial.rows.length, 1);
  const emptyDetail = getCategoryOverview({ 'virtual-machines': file([]) }, 'compute');
  assert.equal(emptyDetail.hasData, true);
  assert.equal(emptyDetail.partial, true);
});

test('all seeded category distributions sum to unique resources and respect subscription scope', () => {
  for (const { group } of CATEGORY_SUMMARIES) {
    const all = getCategoryOverview(seed, group);
    assert.equal(all.partial, false, group);
    assert.equal(new Set(all.rows.map(({ id }) => id.toLowerCase())).size, all.rows.length, group);
    assert.equal(
      all.types.reduce((total, [, count]) => total + count, 0),
      all.rows.length,
      group,
    );
    assert.equal(
      all.locations.reduce((total, [, count]) => total + count, 0),
      all.rows.length,
      group,
    );
    for (const [, , subscription] of all.subscriptionEntries) {
      const scoped = getCategoryOverview(scopeInventory(seed, subscription), group);
      assert.ok(
        scoped.rows.every((row) => row.subscriptionId === subscription),
        group,
      );
      assert.equal(
        scoped.rows.length,
        all.rows.filter((row) => row.subscriptionId === subscription).length,
        group,
      );
    }
  }
});

test('tag coverage counts resources, not tag occurrences, and preserves empty, false and zero values', () => {
  const tagged = [...vm];
  tagged[0] += '-tagged';
  tagged[7] = '{"Environment":"","cost_center":0,"shared":false}';
  const data = getCategoryOverview({ resources: file([vm, tagged]) }, 'tags');
  assert.equal(data.tagged, 1);
  assert.equal(data.untagged, 1);
  assert.equal(tagValue(data.rows[1], 'environment'), '');
  assert.equal(tagValue(data.rows[1], 'cost_center'), '0');
  assert.equal(tagValue(data.rows[1], 'shared'), 'false');
  assert.equal(tagValue(data.rows[0], 'environment'), null);
  assert.equal(resourceTags({ tags_json: 'broken' }), null);
  assert.equal(resourceTags({}), null);
});

test('unknown tag data never contributes to the untagged count', () => {
  const broken = [...vm];
  broken[7] = 'not JSON';
  const data = getCategoryOverview({ resources: file([broken]) }, 'tags');
  assert.equal(data.tagUnknown, 1);
  assert.equal(data.untagged, 0);
  assert.equal(data.partial, true);
});

test('missing dimensions share one selectable empty bucket and SKU aliases preserve known per-resource values', () => {
  const entries = countResources(
    [{ size: undefined }, { size: '' }, {}, { size: 'Standard_B2s' }],
    'size',
  );
  assert.deepEqual(entries, [
    ['', 3],
    ['Standard_B2s', 1],
  ]);
  const emptySelection = JSON.parse(JSON.stringify(['']))[0];
  assert.equal(emptySelection, '');
  assert.equal(
    [{ size: undefined }, { size: '' }, {}].filter((row) => (row.size ?? '') === emptySelection)
      .length,
    3,
  );
  const containers = getCategoryOverview(seed, 'containers');
  assert.ok(containers.dimensionEntries.some(([value]) => value === 'Base'));
  const databases = getCategoryOverview(seed, 'databases');
  for (const resource of databases.rows.filter((row) => row.sku_name)) {
    assert.equal(resource.skuName, resource.sku_name);
  }
  assert.ok(databases.dimensionEntries.some(([value]) => value === 'Standard_D2s_v3'));
});

test('same-named resource groups remain separate across subscriptions and VM detail fields enrich canonical rows', () => {
  const second = [...vm];
  second[0] = '/subscriptions/two/vm/second';
  second[3] = 'two';
  second[4] = 'One';
  const detail = { headers: ['id', 'vmSize'], rows: [[vm[0], 'Standard_B2s']] };
  const data = getCategoryOverview(
    { resources: file([vm, second]), 'virtual-machines': detail },
    'compute',
  );
  assert.equal(new Set(data.rows.map(({ resourceGroupKey }) => resourceGroupKey)).size, 2);
  assert.equal(data.dimension, 'vmSize');
  assert.ok(
    data.dimensionEntries.some(([value, count]) => value === 'Standard_B2s' && count === 1),
  );
});
