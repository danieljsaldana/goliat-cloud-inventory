import { groupTable } from './groupTable.js';
import { sortTableRows } from './sortTableRows.js';

/** @param {import('../types.js').TableFile} file
 * @param {import('../types.js').TableOptions} [options] */
export function tableView(file, { search = '', filters = {}, groupBy = '', sort = null } = {}) {
  const query = search.toLocaleLowerCase('es');
  const rows = file.rows.filter(
    (row) =>
      (!query || row.some((value) => value.toLocaleLowerCase('es').includes(query))) &&
      Object.entries(filters).every(
        ([index, value]) =>
          !value || row[index].toLocaleLowerCase('es').includes(value.toLocaleLowerCase('es')),
      ),
  );
  if (groupBy && file.headers.includes(groupBy)) return groupTable(file.headers, rows, groupBy);
  return { headers: file.headers, rows: sortTableRows(file.headers, rows, sort), grouped: false };
}
