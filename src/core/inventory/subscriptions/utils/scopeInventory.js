import { records } from '../../../table/index.js';

export function scopeInventory(files, subscriptionId) {
  if (!subscriptionId) return files;
  const scoped = {};
  for (const [id, file] of Object.entries(files)) {
    if (id === 'tags') {
      // El informe global mezcla suscripciones. El 17 ya agrupa por los
      // mismos tags dentro de cada suscripción: proyectamos solo su selección.
      const source = files['tags-by-subscription'];
      if (!source) continue;
      scoped[id] = {
        ...file,
        rows: records(source)
          .filter((row) => row.subscriptionId === subscriptionId)
          .map((row) => file.headers.map((header) => row[header] ?? '')),
      };
    } else {
      const column = file.headers.indexOf('subscriptionId');
      scoped[id] = { ...file, rows: file.rows.filter((row) => row[column] === subscriptionId) };
    }
  }
  return scoped;
}
