import { number, records, sumBy } from '../../../table/index.js';

export function getOverviewData(files) {
  const hasResourceData = ['resource-totals', 'resource-types', 'resources'].some((id) =>
    Boolean(files[id]),
  );
  const sourceTypes = records(files['resource-types']);
  const detail = records(files['resources']);
  const types = sourceTypes.length ? sourceTypes : detail.map((row) => ({ ...row, resources: 1 }));
  const totals = records(files['resource-totals']).filter(
    (row) => row.subscriptionId && row.subscriptionId !== 'ALL',
  );
  const total = totals.length
    ? totals.reduce((s, r) => s + number(r.resources), 0)
    : types.reduce((s, r) => s + number(r.resources), 0);
  const activeSubscriptions = new Set([...totals, ...types].map((row) => row.subscriptionId)).size;
  const coverage = records(files['tag-coverage']);
  const tagged = coverage.reduce((s, r) => s + number(r.withTags), 0);
  const coverageTotal = coverage.reduce((s, r) => s + number(r.resources), 0);
  const coveragePercent = coverageTotal ? Math.round((tagged / coverageTotal) * 100) : null;
  const providers = sumBy(types, 'resourceProvider');
  const providerCount = types.length || !total ? providers.filter(([name]) => name).length : null;
  const locations = sumBy(
    detail.map((row) => ({ ...row, resources: 1 })),
    'location',
  );
  const names = new Map(types.map((row) => [row.subscriptionId, row.subscriptionName]));
  const subscriptionEntries = totals.length
    ? totals.map((row) => [row.subscriptionName, number(row.resources), row.subscriptionId])
    : sumBy(types, 'subscriptionId').map(([id, value]) => [names.get(id) || id, value, id]);

  return {
    hasResourceData,
    types,
    total,
    activeSubscriptions,
    tagged,
    coveragePercent,
    providers,
    providerCount,
    locations,
    subscriptionEntries,
  };
}
