import { functionClient } from './functionClient.mjs';
import { collectAzure } from './collectAzure.mjs';
import { handleRefresh } from '../../../refresh/handleRefresh.mjs';
import { getRefreshStatus } from '../../../refresh/getRefreshStatus.mjs';
import { sameOrigin } from '../../../refresh/utils/sameOrigin.mjs';
import { ConfigurationError } from '../../../config.mjs';
import { getLogger } from '../../../logging/logger.mjs';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const pending = new Set(['queued', 'running', 'retrying']);

export async function refreshAzure(
  request,
  {
    env = process.env,
    client,
    importInventory = collectAzure,
    importHandler = handleRefresh,
    databaseStatus = getRefreshStatus,
  } = {},
) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (request.method === 'POST' && !sameOrigin(request, env))
    return Response.json({ error: 'invalid_origin' }, { status: 403, headers });
  const id = new URL(request.url).searchParams.get('operationId');
  if (id !== null && !UUID.test(id))
    return Response.json({ error: 'invalid_operation' }, { status: 400, headers });
  try {
    client ||= functionClient({ env });
    const signal = request.signal;
    if (request.method === 'POST' && !id) {
      const operation = await client.generate(signal);
      return Response.json(
        { operationId: operation.operationId, status: operation.status, running: true },
        { status: 202, headers },
      );
    }
    const operation = id ? await client.operation(id, signal) : await client.current(signal);
    if (request.method === 'GET') {
      const status = await databaseStatus('azure');
      return Response.json(
        {
          ...status,
          running: status.running || pending.has(operation?.status),
          ...(operation ? { operationId: operation.operationId, status: operation.status } : {}),
        },
        { headers },
      );
    }
    if (!operation || operation.status === 'failed')
      return Response.json({ error: 'refresh_generation_failed' }, { status: 502, headers });
    if (pending.has(operation.status))
      return Response.json(
        { operationId: id, status: operation.status, running: true },
        { status: 202, headers },
      );
    if (!operation.etag) throw new Error('La generación no confirma el blob publicado.');
    return importHandler(
      request,
      (options) => importInventory({ ...options, env, expectedEtag: operation.etag }),
      { provider: 'azure', env },
    );
  } catch (error) {
    getLogger().error(
      { err: error, dependency: error.dependency, event: 'refresh.generation.failed' },
      'No se pudo generar el inventario de Azure.',
    );
    const code =
      error instanceof ConfigurationError ? 'refresh_unconfigured' : 'refresh_unavailable';
    return Response.json({ error: code }, { status: 503, headers });
  }
}
