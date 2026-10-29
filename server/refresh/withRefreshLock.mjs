import { getRefreshPool } from '../db.mjs';
import { getLogger } from '../logging/logger.mjs';
import { REFRESH_LOCK_NAMESPACE } from './constants.mjs';
import { RefreshBusyError } from './errors.mjs';
import { lockKey } from './utils/lockKey.mjs';
import { sessionPool } from './utils/sessionPool.mjs';

export async function withRefreshLock(provider, work, { signal, pool = getRefreshPool() } = {}) {
  const key = lockKey(provider);
  signal?.throwIfAborted();
  const connection = await pool.connect();
  const disconnected = new AbortController();
  const abortSignal = signal ? AbortSignal.any([signal, disconnected.signal]) : disconnected.signal;
  const state = { locked: false, discard: false, failed: false };
  function connectionFailed(error) {
    state.discard = true;
    disconnected.abort(error);
  }
  connection.on('error', connectionFailed);
  try {
    abortSignal.throwIfAborted();
    const {
      rows: [lock],
    } = await connection.query(
      'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired',
      [REFRESH_LOCK_NAMESPACE, key],
    );
    if (!lock.acquired) throw new RefreshBusyError();
    state.locked = true;
    const result = await work({ signal: abortSignal, pool: sessionPool(connection, abortSignal) });
    abortSignal.throwIfAborted();
    return result;
  } catch (error) {
    state.failed = true;
    throw error;
  } finally {
    try {
      if (state.locked && !state.discard) {
        if (state.failed) await connection.query('ROLLBACK');
        const {
          rows: [lock],
        } = await connection.query(
          'SELECT pg_advisory_unlock($1::integer, $2::integer) AS released',
          [REFRESH_LOCK_NAMESPACE, key],
        );
        if (!lock.released) throw new Error('No se ha podido liberar el bloqueo de actualización.');
      }
    } catch (error) {
      state.discard = true;
      getLogger().warn(
        { err: error, event: 'refresh.lock.cleanup_failed', provider },
        'Se descarta la conexión para liberar el bloqueo de actualización.',
      );
    } finally {
      connection.removeListener('error', connectionFailed);
      connection.release(state.discard);
    }
  }
}
