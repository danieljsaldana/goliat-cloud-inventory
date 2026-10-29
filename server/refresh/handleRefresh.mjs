import { ConfigurationError, integer } from '../config.mjs';
import { getLogger } from '../logging/logger.mjs';
import { REFRESH_TIMEOUT_MS, MAX_REFRESH_TIMEOUT_MS } from './constants.mjs';
import { sameOrigin } from './utils/sameOrigin.mjs';
import { withRefreshLock } from './withRefreshLock.mjs';
import { RefreshBusyError } from './errors.mjs';

export async function handleRefresh(
  request,
  refresh,
  { provider, env = process.env, lock = withRefreshLock } = {},
) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!sameOrigin(request, env)) {
    return Response.json({ error: 'invalid_origin' }, { status: 403, headers });
  }
  const operation = { timeout: null };
  try {
    const timeout = AbortSignal.timeout(
      integer(env.INVENTORY_REFRESH_TIMEOUT_MS, REFRESH_TIMEOUT_MS, MAX_REFRESH_TIMEOUT_MS),
    );
    operation.timeout = timeout;
    const signal = AbortSignal.any([request.signal, timeout]);
    const result = await lock(provider, refresh, { signal });
    signal.throwIfAborted();
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof RefreshBusyError) {
      getLogger().info(
        { event: 'refresh.busy', provider },
        'Se ha rechazado otra actualización porque ya hay una en curso.',
      );
      return Response.json({ error: 'refresh_busy' }, { status: 409, headers });
    }
    getLogger().error(
      { err: error, event: 'refresh.failed', provider },
      'No se ha podido actualizar los datos desde el almacenamiento cloud.',
    );
    if (operation.timeout?.aborted || error?.name === 'TimeoutError') {
      return Response.json({ error: 'refresh_timeout' }, { status: 504, headers });
    }
    if (request.signal.aborted) {
      return Response.json({ error: 'refresh_canceled' }, { status: 499, headers });
    }
    if (error instanceof ConfigurationError) {
      return Response.json({ error: 'refresh_unconfigured' }, { status: 503, headers });
    }
    return Response.json({ error: 'refresh_unavailable' }, { status: 503, headers });
  }
}
