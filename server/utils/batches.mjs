export function* batches(rows, size) {
  const starts = Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => index * size);
  for (const start of starts) yield { start, items: rows.slice(start, start + size) };
}
