import { cell } from './cell.mjs';

export function reportTable(headers, rows, subscriptions, tagKeys) {
  const columns = Array.isArray(headers)
    ? [...headers]
    : headers.replace('$TAG_COLUMNS', tagKeys.map((key) => `tag_${key}`).join(',')).split(',');
  if (columns.includes('type') && !columns.includes('resourceProvider'))
    columns.splice(columns.indexOf('type'), 0, 'resourceProvider');
  return {
    headers: columns,
    rows: rows.map((source) => {
      const row = {
        ...source,
        subscriptionName: source.subscriptionName ?? subscriptions.get(source.subscriptionId) ?? '',
        resourceProvider: (source.type || source.resourceProvider || '')
          .split('/')[0]
          .toLowerCase(),
        tags_json: JSON.stringify(source.tags || {}),
        sku_name: source.sku?.name || '',
      };
      for (const key of tagKeys)
        row[`tag_${key}`] =
          Object.entries(source.tags || {}).find(
            ([name]) => name.toLowerCase() === key.toLowerCase(),
          )?.[1] ??
          source[`tag_${key}`] ??
          '';
      return columns.map((column) => cell(row[column]));
    }),
  };
}
