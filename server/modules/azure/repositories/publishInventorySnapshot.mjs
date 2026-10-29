import { randomUUID } from 'node:crypto';
import { insertRows } from '../../../db.mjs';
import { batches } from '../../../utils/batches.mjs';

export async function publishInventorySnapshot(connection, files, metadata = {}) {
  const runId = randomUUID();
  const generatedAt = metadata.generatedAt || new Date().toISOString();
  const date = new Date(generatedAt);
  if (!Number.isFinite(date.getTime())) throw new Error('generatedAt no es una fecha válida.');
  await connection.query(
    'INSERT INTO inventory_runs (id, provider, generated_at, metadata) VALUES ($1, $2, $3, $4)',
    [runId, 'azure', date.toISOString(), JSON.stringify({ ...metadata, generatedAt })],
  );
  for (const [id, file] of Object.entries(files)) {
    await connection.query(
      'INSERT INTO inventory_reports (run_id, report_id, headers) VALUES ($1, $2, $3)',
      [runId, id, JSON.stringify(file.headers)],
    );
    const scopeIndex = file.headers.indexOf('subscriptionId');
    for (const { start, items } of batches(file.rows, 200)) {
      const values = items.map((row, index) => [
        runId,
        id,
        start + index,
        scopeIndex < 0 ? '' : row[scopeIndex],
        JSON.stringify(row),
      ]);
      await insertRows(
        connection,
        'inventory_rows',
        ['run_id', 'report_id', 'row_index', 'scope_id', 'payload'],
        values,
      );
    }
  }
  await connection.query(
    'INSERT INTO inventory_heads (provider, run_id) VALUES ($1, $2) ON CONFLICT (provider) DO UPDATE SET run_id = EXCLUDED.run_id',
    ['azure', runId],
  );
  return { runId, reports: Object.keys(files).length, generatedAt };
}
