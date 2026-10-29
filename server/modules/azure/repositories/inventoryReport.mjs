import { getPool, jsonValue, transaction } from '../../../db.mjs';

export async function readInventoryReport(
  { reportId, runId, scope, after, limit },
  pool = getPool(),
) {
  return transaction(
    async (connection) => {
      const query = runId
        ? 'SELECT id, metadata FROM inventory_runs WHERE provider = $1 AND id = $2'
        : 'SELECT r.id, r.metadata FROM inventory_heads h JOIN inventory_runs r ON r.id = h.run_id WHERE h.provider = $1';
      const {
        rows: [run],
      } = await connection.query(query, runId ? ['azure', runId] : ['azure']);
      if (!run) return null;
      const {
        rows: [report],
      } = await connection.query(
        'SELECT headers FROM inventory_reports WHERE run_id = $1 AND report_id = $2',
        [run.id, reportId],
      );
      if (!report) return null;
      const parameters = [run.id, reportId, after];
      const scopeCondition = scope === null ? '' : ' AND scope_id = $4';
      if (scope !== null) parameters.push(scope);
      parameters.push(limit + 1);
      const { rows } = await connection.query(
        `SELECT row_index, payload FROM inventory_rows WHERE run_id = $1 AND report_id = $2 AND row_index > $3${scopeCondition} ORDER BY row_index LIMIT $${parameters.length}`,
        parameters,
      );
      const items = rows.slice(0, limit);
      return {
        runId: run.id,
        reportId,
        metadata: jsonValue(run.metadata),
        limit,
        nextCursor: rows.length > limit ? items.at(-1).row_index : null,
        file: {
          headers: jsonValue(report.headers),
          rows: items.map(({ payload }) => jsonValue(payload)),
        },
      };
    },
    pool,
    { readOnly: true },
  );
}
