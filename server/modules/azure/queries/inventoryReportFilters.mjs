import { integer } from '../../../config.mjs';
import { REPORTS } from '../../../../src/core/inventory/reports.js';

export function inventoryReportFilters(reportId, searchParams) {
  if (!REPORTS.some(({ id }) => id === reportId)) throw new Error('Informe desconocido.');
  const after = searchParams.get('after');
  if (
    after !== null &&
    (!/^\d+$/.test(after) || !Number.isSafeInteger(Number(after)) || Number(after) > 2147483647)
  )
    throw new Error('Cursor inválido.');
  const runId = searchParams.get('runId') || null;
  if (runId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId))
    throw new Error('Snapshot inválido.');
  const scope = searchParams.get('scope');
  if (scope !== null && scope.length > 128) throw new Error('Ámbito inválido.');
  return {
    reportId,
    runId,
    scope,
    after: after === null ? -1 : Number(after),
    limit: integer(searchParams.get('limit'), 100, 500),
  };
}
