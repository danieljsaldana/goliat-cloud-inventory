import { administratorAllowed } from './utils/administratorAllowed.mjs';
import { objectIdPattern } from '../members/constants.mjs';
import { getPool } from '../db.mjs';
import { getLogger } from '../logging/logger.mjs';

export async function applicationAdministrator(session, settings, env = process.env, pool) {
  if (administratorAllowed(session, settings, env)) return true;
  const identity = session?.identity;
  if (
    env.DASHBOARD_MEMBERS_ENABLED !== 'true' ||
    !settings?.enabled ||
    settings.mode !== 'azure-ad' ||
    session?.authMode !== 'azure-ad' ||
    !objectIdPattern.test(identity?.objectId || '') ||
    typeof identity?.tenantId !== 'string' ||
    identity.tenantId.toLowerCase() !== settings.tenantId
  )
    return false;
  try {
    const { rows } = await (pool || getPool()).query(
      'SELECT 1 FROM application_administrators WHERE tenant_id = $1 AND object_id = $2',
      [settings.tenantId, identity.objectId.toLowerCase()],
    );
    return rows.length === 1;
  } catch (error) {
    getLogger().error(
      { event: 'members.authorization.failed', code: error.code || error.name },
      'No se ha podido comprobar el permiso de administrador.',
    );
    return false;
  }
}
