import { number } from './number.js';

export function sumBy(rows, key, value = 'resources') {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) || 0) + number(row[value]));
  return [...counts].sort((a, b) => b[1] - a[1]);
}
