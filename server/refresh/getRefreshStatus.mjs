import { getPool } from '../db.mjs';
import { REFRESH_LOCK_NAMESPACE } from './constants.mjs';
import { lockKey } from './utils/lockKey.mjs';

export async function getRefreshStatus(provider, pool = getPool()) {
  const {
    rows: [status],
  } = await pool.query(
    `SELECT EXISTS (
      SELECT 1 FROM pg_locks
      WHERE locktype = 'advisory' AND granted
        AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
        AND classid = $1::oid AND objid = $2::oid AND objsubid = 2
    ) AS running`,
    [REFRESH_LOCK_NAMESPACE, lockKey(provider)],
  );
  return { running: status.running };
}
