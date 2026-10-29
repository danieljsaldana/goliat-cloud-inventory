import { cell } from './cell.mjs';

export function groupAzureTags(rows, subscriptions, tagKeys, bySubscription) {
  const groups = new Map();
  for (const row of rows) {
    const tags = row.tagsJson ? JSON.parse(row.tagsJson) || {} : {};
    const values = tagKeys.map((key) =>
      cell(Object.entries(tags).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1]),
    );
    const subscriptionId = bySubscription ? row.subscriptionId : 'ALL';
    const key = JSON.stringify([subscriptionId, ...values]);
    if (!groups.has(key))
      groups.set(key, {
        subscriptionId,
        subscriptionName: subscriptions.get(subscriptionId) || 'ALL',
        ...Object.fromEntries(tagKeys.map((tag, index) => [`tag_${tag}`, values[index]])),
        resources: 0,
        providers: new Map(),
        types: new Map(),
      });
    const group = groups.get(key);
    const count = Number(row.resources);
    group.resources += count;
    group.providers.set(
      row.resourceProvider,
      (group.providers.get(row.resourceProvider) || 0) + count,
    );
    group.types.set(row.type, (group.types.get(row.type) || 0) + count);
  }
  const counts = (map) =>
    [...map]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  return [...groups.values()]
    .map((group) => ({
      ...group,
      resourceProviders: counts(group.providers),
      types: counts(group.types),
    }))
    .sort((a, b) => a.subscriptionId.localeCompare(b.subscriptionId) || b.resources - a.resources);
}
