import { REPORT_GROUPS, REPORTS } from './reports.js';
import serviceReports from './reports/service-reports.json' with { type: 'json' };
import { records, sumBy } from '../table/index.js';

export const CATEGORY_SUMMARIES = REPORT_GROUPS.filter(({ id }) => id !== 'inventory').map(
  ({ id, labelKey }) => ({
    id: `${id}-overview`,
    group: id,
    labelKey: `category.titles.${id}`,
    groupLabelKey: labelKey,
    icon: 'chart',
    summary: true,
  }),
);

// Match the producer's resource selection, without counting aggregate or child-report rows.
const baseTypes = {
  compute: ['microsoft.compute/virtualmachines'],
  containers: ['microsoft.containerservice/managedclusters'],
  web: ['microsoft.web/sites', 'microsoft.web/serverfarms', 'microsoft.apimanagement/service'],
  network: [
    'microsoft.network/virtualnetworks',
    'microsoft.network/privateendpoints',
    'microsoft.network/networksecuritygroups',
    'microsoft.network/connections',
    'microsoft.network/trafficmanagerprofiles',
    'microsoft.network/virtualwans',
    'microsoft.network/virtualhubs',
  ],
  storage: [
    'microsoft.storage/storageaccounts',
    'microsoft.recoveryservices/vaults',
    'microsoft.dataprotection/backupvaults',
  ],
  security: ['microsoft.keyvault/vaults', 'microsoft.keyvault/managedhsms'],
  data: ['microsoft.cognitiveservices/accounts', 'microsoft.machinelearningservices/workspaces'],
  monitoring: [
    'microsoft.insights/components',
    'microsoft.insights/metricalerts',
    'microsoft.insights/scheduledqueryrules',
    'microsoft.insights/actiongroups',
    'microsoft.alertsmanagement/smartdetectoralertrules',
  ],
};
const categoryTypes = new Map(
  CATEGORY_SUMMARIES.map(({ group }) => [
    group,
    new Set([
      ...(baseTypes[group] || []),
      ...serviceReports.filter((report) => report.group === group).flatMap(({ types }) => types),
    ]),
  ]),
);

export const CATEGORY_DIMENSIONS = {
  compute: ['vmSize', 'powerState', 'osType'],
  containers: ['skuName', 'provisioningState'],
  web: ['kind', 'skuName'],
  network: ['provisioningState', 'skuName'],
  storage: ['skuName', 'sku_name'],
  databases: ['type', 'skuName', 'sku_name'],
  security: ['type', 'provisioningState'],
  integration: ['type', 'kind'],
  data: ['kind', 'skuName'],
  monitoring: ['type', 'kind'],
};

export function resourceInCategory(row, group) {
  if (group === 'tags') return true;
  const type = String(row.type || '').toLowerCase();
  if (type === 'microsoft.web/sites') {
    const workflow = String(row.kind || '')
      .toLowerCase()
      .includes('workflowapp');
    return group === (workflow ? 'integration' : 'web');
  }
  if (
    group === 'databases' &&
    /^microsoft\.(dbforpostgresql|dbformysql|dbformariadb|sql|documentdb|cache)\//.test(type)
  )
    return true;
  return categoryTypes.get(group)?.has(type) || false;
}

export function resourceTags(row) {
  try {
    const tags = JSON.parse(row.tags_json ?? 'null');
    if (tags && typeof tags === 'object' && !Array.isArray(tags)) return tags;
  } catch {
    /* Invalid tag JSON is unknown, never an assertion of absent tags. */
  }
  return null;
}

export function tagValue(row, key) {
  const tags = resourceTags(row);
  const actual = Object.keys(tags || {}).find((name) => name.toLowerCase() === key.toLowerCase());
  return actual === undefined ? null : String(tags[actual]);
}

export function countResources(rows, key) {
  return sumBy(
    rows.map((row) => ({ ...row, [key]: row[key] ?? '', resources: 1 })),
    key,
  );
}

export function getCategoryOverview(files, group) {
  const reports = REPORTS.filter((report) => report.group === group);
  const details = new Map();
  const source = records(files.resources);
  // Canonical resources define membership and totals; service details enrich their fields.
  for (const report of reports) {
    for (const row of records(files[report.id])) {
      if (!row.id) continue;
      const id = row.id.toLowerCase();
      details.set(id, { ...details.get(id), ...row });
    }
  }
  const canonical = files.resources ? source : [...details.values()];
  const unique = new Map();
  for (const row of canonical) {
    if (!resourceInCategory(row, group)) continue;
    const identity = (
      row.id || JSON.stringify([row.subscriptionId, row.resourceGroup, row.type, row.name])
    ).toLowerCase();
    const enriched = { ...details.get(identity), ...row };
    unique.set(identity, {
      ...enriched,
      skuName: enriched.skuName || enriched.sku_name || '',
      resourceGroupKey: JSON.stringify([row.subscriptionId || '', row.resourceGroup || '']),
    });
  }
  const rows = [...unique.values()];
  const hasData =
    Boolean(files.resources) ||
    details.size > 0 ||
    reports.some(({ id }) => files[id]?.headers.includes('id'));
  const types = countResources(rows, 'type');
  const locations = countResources(rows, 'location');
  const subscriptions = new Map();
  for (const row of rows) {
    const id = row.subscriptionId || '';
    const entry = subscriptions.get(id) || [row.subscriptionName || id, 0, id];
    entry[1] += 1;
    subscriptions.set(id, entry);
  }
  const tagKeys = [
    ...new Set(
      rows.flatMap((row) => Object.keys(resourceTags(row) || {}).map((key) => key.toLowerCase())),
    ),
  ].sort();
  const dimension = (CATEGORY_DIMENSIONS[group] || []).find(
    (key) => key !== 'type' && rows.some((row) => row[key] !== undefined && row[key] !== ''),
  );
  const tagged = rows.filter((row) => Object.keys(resourceTags(row) || {}).length > 0).length;
  const tagUnknown = rows.filter((row) => resourceTags(row) === null).length;
  const tagCoverage = [...subscriptions.values()].map(([name, total, subscriptionId]) => {
    const subset = rows.filter((row) => row.subscriptionId === subscriptionId);
    const tagged = subset.filter((row) => Object.keys(resourceTags(row) || {}).length).length;
    const unknown = subset.filter((row) => resourceTags(row) === null).length;
    return { name, subscriptionId, tagged, untagged: total - tagged - unknown, unknown };
  });
  const tableHeaders = [
    'name',
    'type',
    'subscriptionName',
    'subscriptionId',
    'resourceGroup',
    'location',
    'tags_json',
    'id',
  ];
  return {
    rows,
    reports,
    hasData,
    partial: !files.resources || reports.some(({ id }) => !files[id]) || tagUnknown > 0,
    types,
    locations,
    subscriptionEntries: [...subscriptions.values()].sort((a, b) => b[1] - a[1]),
    dimension,
    dimensionEntries: dimension ? countResources(rows, dimension) : [],
    tagKeys,
    tagged,
    untagged: rows.length - tagged - tagUnknown,
    tagUnknown,
    tagCoverage,
    tableHeaders,
  };
}
