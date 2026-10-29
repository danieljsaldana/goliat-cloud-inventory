import { REPORTS } from '../../reports.js';
import { CATEGORY_SUMMARIES } from '../../categories.js';
import { SEARCH_LIMITS } from '../constants.js';
import { normalizeSearch } from './normalizeSearch.js';

export function searchInventory(index, files, query, t) {
  const text = normalizeSearch(query);
  const terms = text.split(/\s+/).filter(Boolean);
  const reports = [
    ...REPORTS.filter(({ id }) => files[id]),
    ...(Object.keys(files).length ? CATEGORY_SUMMARIES : []),
  ].map(({ id, labelKey }) => ({
    kind: 'reports',
    key: id,
    id,
    name: t(labelKey),
    nameText: normalizeSearch(t(labelKey)),
    searchText: normalizeSearch(`${id} ${t(labelKey)}`),
  }));
  const entries = text ? [...index, ...reports] : reports;
  const matches = entries
    .filter((entry) => terms.every((term) => entry.searchText.includes(term)))
    .map((entry) => ({
      ...entry,
      rank: Number(entry.nameText !== text) + Number(!entry.nameText.startsWith(text)),
    }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'es'));
  const groups = Object.entries(SEARCH_LIMITS).map(([kind, limit]) => ({
    kind,
    items: matches.filter((entry) => entry.kind === kind).slice(0, limit),
  }));
  return {
    groups,
    total: matches.length,
    shown: groups.reduce((sum, group) => sum + group.items.length, 0),
  };
}
