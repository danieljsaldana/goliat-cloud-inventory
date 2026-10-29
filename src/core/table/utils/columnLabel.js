export function columnLabel(header, t) {
  if (header === 'filas') return t('table.rowsColumn');
  if (header === 'suma resources') return t('table.resourcesSumColumn');
  const key = `table.columns.${header}`;
  const label = t(key);
  if (label !== key) return label;
  if (header.startsWith('tag_')) return t('table.tagColumn', { name: header.slice(4) });
  return t(header);
}
