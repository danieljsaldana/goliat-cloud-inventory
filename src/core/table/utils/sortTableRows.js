import { number } from './number.js';
import { isNumericColumn } from './isNumericColumn.js';

export function sortTableRows(headers, rows, sort) {
  if (!sort) return rows;
  const index = headers.indexOf(sort.key);
  if (index < 0) return rows;
  const numeric = isNumericColumn(rows, index);
  return rows.slice().sort((a, b) => {
    const difference = numeric
      ? number(a[index]) - number(b[index])
      : a[index].localeCompare(b[index], 'es', { numeric: true });
    return sort.direction * difference;
  });
}
