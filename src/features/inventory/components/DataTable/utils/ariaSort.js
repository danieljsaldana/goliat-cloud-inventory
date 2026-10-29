export function ariaSort(header, grouped, sort) {
  if (grouped || sort?.key !== header) return undefined;
  return sort.direction === 1 ? 'ascending' : 'descending';
}
