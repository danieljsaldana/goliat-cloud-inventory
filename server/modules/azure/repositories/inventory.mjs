import { getPool, jsonValue, transaction } from '../../../db.mjs';
import { publishInventorySnapshot } from './publishInventorySnapshot.mjs';
export async function writeInventorySnapshot(files, metadata = {}, pool = getPool()) {
  return transaction((connection) => publishInventorySnapshot(connection, files, metadata), pool);
}

export async function readInventorySnapshot(pool = getPool()) {
  // Una lectura repetible evita mezclar informes si se publica otro snapshot durante la consulta.
  return transaction(
    async (connection) => {
      const {
        rows: [run],
      } = await connection.query(
        'SELECT r.id, r.metadata FROM inventory_heads h JOIN inventory_runs r ON r.id = h.run_id WHERE h.provider = $1',
        ['azure'],
      );
      if (!run) return { loading: false, files: {}, metadata: null, errors: [] };
      const { rows: reports } = await connection.query(
        'SELECT report_id, headers FROM inventory_reports WHERE run_id = $1',
        [run.id],
      );
      const { rows } = await connection.query(
        'SELECT report_id, payload FROM inventory_rows WHERE run_id = $1 ORDER BY report_id, row_index',
        [run.id],
      );
      const files = Object.fromEntries(
        reports.map((report) => [
          report.report_id,
          { headers: jsonValue(report.headers), rows: [] },
        ]),
      );
      for (const row of rows) files[row.report_id].rows.push(jsonValue(row.payload));
      return {
        loading: false,
        files,
        metadata: jsonValue(run.metadata),
        errors: [],
      };
    },
    pool,
    { readOnly: true },
  );
}
