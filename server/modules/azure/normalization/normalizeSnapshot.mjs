import { reportTable } from './utils/reportTable.mjs';
import { expandAzureRows } from './utils/expandAzureRows.mjs';
import { groupAzureTags } from './utils/groupAzureTags.mjs';
import { NORMALIZATION_VERSION } from '../constants.mjs';
import { validateSnapshot } from './validateSnapshot.mjs';

export function normalizeAzureSnapshot({ catalog, tagKeys, reports, totals, tags }, generatedAt) {
  const subscriptions = new Map(
    catalog.map((item) => [item.subscriptionId, item.subscriptionName]),
  );
  const table = (headers, rows) => reportTable(headers, rows, subscriptions, tagKeys);
  const files = Object.fromEntries(
    reports.map(({ id, headers, rows }) => [id, table(headers, expandAzureRows(id, rows))]),
  );
  files['subscriptions'] = table(
    ['subscriptionId', 'subscriptionName', 'state', 'tenantId'],
    catalog,
  );
  files['resource-totals'] = table(
    ['subscriptionName', 'subscriptionId', 'resources', 'distinctTypes'],
    [
      ...totals,
      {
        subscriptionName: 'ALL',
        subscriptionId: '',
        resources: totals.reduce((sum, row) => sum + Number(row.resources), 0),
        distinctTypes: null,
      },
    ],
  );
  for (const [id, bySubscription] of [
    ['tags-by-subscription', true],
    ['tags', false],
  ]) {
    files[id] = table(
      [
        'subscriptionName',
        'subscriptionId',
        ...tagKeys.map((key) => `tag_${key}`),
        'resources',
        'resourceProviders',
        'types',
      ],
      groupAzureTags(tags, subscriptions, tagKeys, bySubscription),
    );
  }
  validateSnapshot(files, { complete: true });
  return {
    files,
    metadata: {
      generatedAt,
      source: 'azure-sdk',
      provider: 'azure',
      normalizationVersion: NORMALIZATION_VERSION,
      subscriptions: catalog.length,
      tagKeys,
      complete: true,
    },
  };
}
