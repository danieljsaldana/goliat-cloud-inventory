export function gridRows(items, columns) {
  if (!Number.isInteger(columns) || columns < 1) {
    throw new RangeError('The grid must have at least one column.');
  }
  return Array.from({ length: Math.ceil(items.length / columns) }, (_, row) =>
    items.slice(row * columns, (row + 1) * columns),
  );
}
