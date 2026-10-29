import { getPool, transaction } from '../db.mjs';
import { administratorAllowed } from '../access/utils/administratorAllowed.mjs';
import { objectIdPattern, memberRoles } from './constants.mjs';

export function membersRepository({ pool, env = process.env } = {}) {
  const database = () => pool || getPool();
  return {
    async administrators(tenantId) {
      const { rows } = await database().query(
        'SELECT object_id FROM application_administrators WHERE tenant_id = $1',
        [tenantId],
      );
      return rows.map((row) => row.object_id);
    },
    async update({ session, settings, objectId, role, expectedRole }) {
      const actorId = session?.identity?.objectId?.toLowerCase();
      if (
        typeof objectId !== 'string' ||
        !objectIdPattern.test(objectId) ||
        !objectIdPattern.test(actorId || '') ||
        session.authMode !== 'azure-ad' ||
        session.identity.tenantId?.toLowerCase() !== settings.tenantId ||
        !memberRoles.includes(role) ||
        !memberRoles.includes(expectedRole)
      )
        throw Object.assign(new Error('invalid_member'), { status: 400 });
      const targetId = objectId.toLowerCase();
      const targetSession = {
        ...session,
        identity: { objectId: targetId, tenantId: settings.tenantId },
      };
      if (administratorAllowed(targetSession, settings, env))
        throw Object.assign(new Error('protected_administrator'), { status: 409 });
      if (targetId === actorId) throw Object.assign(new Error('self_role_change'), { status: 409 });
      return transaction(async (connection) => {
        await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `goliat-members:${settings.tenantId}`,
        ]);
        const { rows: administrators } = await connection.query(
          'SELECT object_id FROM application_administrators WHERE tenant_id = $1',
          [settings.tenantId],
        );
        const ids = new Set(administrators.map((row) => row.object_id));
        // Recheck inside the lock: an administrator revoked while Graph was loading cannot write.
        if (!administratorAllowed(session, settings, env) && !ids.has(actorId))
          throw Object.assign(new Error('administrator_required'), { status: 403 });
        const previousRole = ids.has(targetId) ? 'administrator' : 'member';
        if (previousRole !== expectedRole)
          throw Object.assign(new Error('role_conflict'), { status: 409 });
        if (previousRole === role) return { changed: false, role };
        if (role === 'administrator')
          await connection.query(
            'INSERT INTO application_administrators (tenant_id, object_id, granted_by) VALUES ($1, $2, $3)',
            [settings.tenantId, targetId, actorId],
          );
        else
          await connection.query(
            'DELETE FROM application_administrators WHERE tenant_id = $1 AND object_id = $2',
            [settings.tenantId, targetId],
          );
        await connection.query(
          `INSERT INTO application_role_audit (tenant_id, object_id, actor_id, previous_role, new_role)
           VALUES ($1, $2, $3, $4, $5)`,
          [settings.tenantId, targetId, actorId, previousRole, role],
        );
        return { changed: true, role };
      }, database());
    },
  };
}
