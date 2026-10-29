import contract from './contract.json' with { type: 'json' };
import { resourceRow } from './resourceRow.mjs';

const types = {
  'virtual-machines': ['microsoft.compute/virtualmachines'],
  aks: ['microsoft.containerservice/managedclusters'],
  'aks-node-pools': ['microsoft.containerservice/managedclusters'],
  'web-apps': ['microsoft.web/sites'],
  'app-service-plans': ['microsoft.web/serverfarms'],
  'ai-services': [
    'microsoft.cognitiveservices/accounts',
    'microsoft.machinelearningservices/workspaces',
  ],
  'api-management': ['microsoft.apimanagement/service'],
  'virtual-networks': ['microsoft.network/virtualnetworks'],
  subnets: ['microsoft.network/virtualnetworks'],
  'private-endpoints': ['microsoft.network/privateendpoints'],
  'network-security-groups': ['microsoft.network/networksecuritygroups'],
  'network-security-rules': ['microsoft.network/networksecuritygroups'],
  'network-services': [
    'microsoft.network/publicipaddresses',
    'microsoft.network/publicipprefixes',
    'microsoft.network/loadbalancers',
    'microsoft.network/applicationgateways',
    'microsoft.network/virtualnetworkgateways',
    'microsoft.network/connections',
    'microsoft.network/natgateways',
    'microsoft.network/azurefirewalls',
    'microsoft.network/firewallpolicies',
    'microsoft.network/trafficmanagerprofiles',
    'microsoft.network/frontdoors',
    'microsoft.cdn/profiles',
    'microsoft.network/bastionhosts',
    'microsoft.network/vpngateways',
    'microsoft.network/virtualwans',
    'microsoft.network/virtualhubs',
  ],
  'storage-accounts': ['microsoft.storage/storageaccounts'],
  'key-vaults': ['microsoft.keyvault/vaults', 'microsoft.keyvault/managedhsms'],
  'monitoring-resources': [
    'microsoft.insights/components',
    'microsoft.insights/metricalerts',
    'microsoft.insights/scheduledqueryrules',
    'microsoft.insights/actiongroups',
    'microsoft.operationalinsights/workspaces',
    'microsoft.alertsmanagement/smartdetectoralertrules',
  ],
  'backup-vaults': ['microsoft.recoveryservices/vaults', 'microsoft.dataprotection/backupvaults'],
  ...Object.fromEntries(contract.services.map(({ id, types }) => [id, types])),
};

function countBy(rows, fields, counter = 'resources') {
  const groups = new Map();
  for (const row of rows) {
    const values = fields.map((field) => row[field] ?? '');
    const key = JSON.stringify(values);
    if (!groups.has(key))
      groups.set(key, {
        ...Object.fromEntries(fields.map((field, index) => [field, values[index]])),
        [counter]: 0,
      });
    groups.get(key)[counter] += 1;
  }
  return [...groups.values()];
}

function select(reportId, resources) {
  if (reportId === 'resources') return resources;
  if (reportId === 'databases')
    return resources.filter((r) =>
      /^(microsoft\.(dbforpostgresql|dbformysql|dbformariadb|sql|documentdb|cache))\//.test(
        r.type.toLowerCase(),
      ),
    );
  return resources.filter((r) => {
    if (!(types[reportId] || []).includes(r.type.toLowerCase())) return false;
    const descriptor = contract.services.find(({ id }) => id === reportId);
    if (
      descriptor?.kindContains &&
      !(r.kind || '').toLowerCase().includes(descriptor.kindContains.toLowerCase())
    )
      return false;
    if (reportId === 'functions')
      return (
        (r.kind || '').toLowerCase().includes('functionapp') &&
        !(r.kind || '').toLowerCase().includes('workflowapp')
      );
    if (reportId === 'logic-apps' && r.type.toLowerCase() === 'microsoft.web/sites')
      return (r.kind || '').toLowerCase().includes('workflowapp');
    return true;
  });
}

export function buildDocument(
  { catalog, resources, groups },
  configuredTagKeys = [],
  generatedAt = new Date().toISOString(),
) {
  const names = new Map(catalog.map((item) => [item.subscriptionId, item.subscriptionName]));
  const tagNames = new Map(configuredTagKeys.map((key) => [key.toLowerCase(), key]));
  if (!configuredTagKeys.length) {
    for (const resource of resources)
      for (const key of Object.keys(resource.tags || {}))
        if (!tagNames.has(key.toLowerCase())) tagNames.set(key.toLowerCase(), key);
  }
  const tagKeys = [...tagNames.values()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
  const baseHeaders = contract.reports.find((report) => report.id === 'resources').headers;
  const detail = resources.map((resource) => resourceRow(resource, baseHeaders, names));
  const tagRows = detail.flatMap((r) =>
    Object.entries(r.tags).map(([tagKey, value]) => ({
      subscriptionId: r.subscriptionId,
      subscriptionName: r.subscriptionName,
      resourceProvider: r.resourceProvider,
      type: r.type,
      tagKey: tagKey.toLowerCase(),
      tagValue: String(value),
    })),
  );
  const coverage = countBy(detail, ['subscriptionId', 'subscriptionName', 'resourceProvider']);
  for (const row of coverage) {
    row.withTags = detail.filter(
      (r) =>
        r.subscriptionId === row.subscriptionId &&
        r.resourceProvider === row.resourceProvider &&
        Object.keys(r.tags).length,
    ).length;
    row.withoutTags = row.resources - row.withTags;
  }
  const keys = countBy(tagRows, ['subscriptionId', 'subscriptionName', 'tagKey']);
  for (const row of keys)
    row.distinctValues = new Set(
      tagRows
        .filter((r) => r.subscriptionId === row.subscriptionId && r.tagKey === row.tagKey)
        .map((r) => r.tagValue),
    ).size;
  const vmHeaders = contract.reports.find((report) => report.id === 'virtual-machines').headers;
  const vms = select('virtual-machines', resources).map((r) => resourceRow(r, vmHeaders, names));
  const calculated = {
    'resource-types': countBy(detail, [
      'subscriptionId',
      'subscriptionName',
      'resourceProvider',
      'type',
      'kind',
    ]),
    'tag-coverage': coverage,
    'tag-keys': keys,
    'resources-by-tag': countBy(tagRows, [
      'subscriptionId',
      'subscriptionName',
      'tagKey',
      'tagValue',
      'resourceProvider',
      'type',
    ]),
    'resource-groups': groups.map((group) => ({
      subscriptionId: group.subscriptionId,
      subscriptionName: names.get(group.subscriptionId),
      resourceGroup: group.name,
      location: group.location,
      tags: group.tags || {},
      resources: detail.filter(
        (r) =>
          r.subscriptionId === group.subscriptionId &&
          (r.resourceGroup || '').toLowerCase() === group.name.toLowerCase(),
      ).length,
    })),
    'virtual-machine-summary': countBy(
      vms,
      ['subscriptionId', 'subscriptionName', 'location', 'osType', 'vmSize', 'powerState'],
      'vms',
    ),
  };
  const reports = contract.reports.map(({ id, headers }) => ({
    id,
    headers: headers.flatMap((header) =>
      header === 'tags_json' ? [...tagKeys.map((key) => `tag_${key}`), header] : [header],
    ),
    rows:
      calculated[id] ||
      select(id, resources).map((resource) => resourceRow(resource, headers, names)),
  }));
  const tags = countBy(
    detail.map((r) => ({
      ...r,
      tagsJson: JSON.stringify(
        Object.fromEntries(Object.entries(r.tags).sort(([a], [b]) => a.localeCompare(b))),
      ),
    })),
    ['subscriptionId', 'resourceProvider', 'type', 'tagsJson'],
  );
  const totals = catalog.map(({ subscriptionId }) => {
    const rows = detail.filter((r) => r.subscriptionId === subscriptionId);
    return {
      subscriptionId,
      resources: rows.length,
      distinctTypes: new Set(rows.map((r) => r.type)).size,
    };
  });
  return {
    schemaVersion: contract.schemaVersion,
    provider: 'azure',
    generatedAt,
    snapshot: { catalog, tagKeys, reports, totals, tags },
  };
}
