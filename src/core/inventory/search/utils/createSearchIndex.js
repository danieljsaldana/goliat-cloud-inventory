import { REPORTS } from '../../reports.js';
import { listSubscriptions } from '../../subscriptions.js';
import { normalizeSearch } from './normalizeSearch.js';

/** Index only resource rows with an ARM ID; aggregate reports are navigation entries. */
export function createSearchIndex(files) {
  const resources = new Map();
  // Prefer a service's detail view; the generic resource report fills coverage gaps.
  const reports = [...REPORTS.filter(({ id }) => id !== 'resources'), { id: 'resources' }];
  for (const report of reports) {
    const file = files[report.id];
    if (!file) continue;
    const idColumn = file.headers.indexOf('id');
    const nameColumn = file.headers.indexOf('name');
    if (idColumn < 0 || nameColumn < 0) continue;
    const subscriptionColumn = file.headers.indexOf('subscriptionId');
    const subscriptionNameColumn = file.headers.indexOf('subscriptionName');
    for (const row of file.rows) {
      const id = row[idColumn];
      if (!id || !row[nameColumn]) continue;
      const key = id.toLocaleLowerCase('en-US');
      const tagKeys = file.headers
        .filter((header, column) => header.startsWith('tag_') && row[column])
        .join(' ');
      const text = normalizeSearch([...row, tagKeys].join(' '));
      const existing = resources.get(key);
      if (existing) {
        existing.searchText += ' ' + text;
        continue;
      }
      resources.set(key, {
        kind: 'resources',
        key,
        id,
        name: row[nameColumn],
        nameText: normalizeSearch(row[nameColumn]),
        subscriptionId: row[subscriptionColumn] || '',
        subscriptionName: row[subscriptionNameColumn] || row[subscriptionColumn] || '',
        resourceGroup: row[file.headers.indexOf('resourceGroup')] || '',
        reportId: report.id,
        searchText: text,
      });
    }
  }
  const subscriptions = listSubscriptions(files).map(({ id, name }) => ({
    kind: 'subscriptions',
    key: id,
    id,
    name,
    nameText: normalizeSearch(name),
    searchText: normalizeSearch(`${name} ${id}`),
  }));
  return [...resources.values(), ...subscriptions];
}
