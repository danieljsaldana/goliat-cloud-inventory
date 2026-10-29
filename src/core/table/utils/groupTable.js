import { number } from './number.js';

export function groupTable(headers, rows, groupBy) {
  const groupIndex = headers.indexOf(groupBy);
  const resourceIndex = headers.indexOf('resources');
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row[groupIndex]) || [0, 0];
    group[0]++;
    group[1] += resourceIndex >= 0 ? number(row[resourceIndex]) : 0;
    groups.set(row[groupIndex], group);
  }
  const groupedRows = [...groups].map(([key, values]) => [
    key,
    String(values[0]),
    ...(resourceIndex >= 0 ? [String(values[1])] : []),
  ]);
  groupedRows.sort((a, b) => number(b.at(-1)) - number(a.at(-1)));
  return {
    headers: [groupBy, 'filas', ...(resourceIndex >= 0 ? ['suma resources'] : [])],
    rows: groupedRows,
    grouped: true,
  };
}
