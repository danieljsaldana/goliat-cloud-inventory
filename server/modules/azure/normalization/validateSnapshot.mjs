import { REPORTS } from '../../../../src/core/inventory/reports.js';
export function validateSnapshot(files, { complete = false } = {}) {
  const known = new Set(REPORTS.map(({ id }) => id));
  if (!Object.keys(files).length) throw new Error('El inventario no contiene informes.');
  if (complete && REPORTS.some(({ id }) => !files[id]))
    throw new Error('El snapshot Azure está incompleto.');
  for (const [id, file] of Object.entries(files)) {
    if (
      !known.has(id) ||
      !Array.isArray(file.headers) ||
      !Array.isArray(file.rows) ||
      file.rows.some((row) => !Array.isArray(row) || row.length !== file.headers.length)
    )
      throw new Error(`Informe inválido: ${id}.`);
  }
}
