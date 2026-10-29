import { membersSettings } from './settings.mjs';
import { memberDirectory } from './directory.mjs';
import { membersRepository } from './repository.mjs';
import { administratorAllowed } from '../access/utils/administratorAllowed.mjs';
import { objectIdPattern, memberRoles } from './constants.mjs';

export function membersService({
  env = process.env,
  directory,
  repository,
  now = () => new Date(),
} = {}) {
  const settings = membersSettings(env);
  directory ||= memberDirectory({ env });
  repository ||= membersRepository({ env });
  return {
    async read(session, signal) {
      const [users, administrators] = await Promise.all([
        directory.list(signal),
        repository.administrators(settings.tenantId),
      ]);
      const ids = new Set(administrators);
      if (
        !users.some(
          (user) => user.objectId === session?.identity?.objectId?.toLowerCase() && user.enabled,
        )
      )
        throw Object.assign(new Error('administrator_required'), { status: 403 });
      const members = users.map((user) => {
        const protectedAdministrator = administratorAllowed(
          {
            authMode: 'azure-ad',
            identity: { tenantId: settings.tenantId, objectId: user.objectId },
          },
          settings,
          env,
        );
        return {
          ...user,
          role: protectedAdministrator || ids.has(user.objectId) ? 'administrator' : 'member',
          protectedAdministrator,
        };
      });
      return {
        members,
        tenantId: settings.tenantId,
        currentObjectId: session.identity.objectId.toLowerCase(),
        accessMode: 'tenant',
        checkedAt: now().toISOString(),
      };
    },
    async update(session, input, signal) {
      if (
        !input ||
        Array.isArray(input) ||
        Object.keys(input).some((key) => !['objectId', 'role', 'expectedRole'].includes(key)) ||
        typeof input.objectId !== 'string' ||
        !objectIdPattern.test(input.objectId || '') ||
        !memberRoles.includes(input.role) ||
        !memberRoles.includes(input.expectedRole)
      )
        throw Object.assign(new Error('invalid_member'), { status: 400 });
      const [user, actor] = await Promise.all([
        directory.user(input.objectId.toLowerCase(), signal),
        directory.user(session.identity.objectId.toLowerCase(), signal),
      ]);
      if (!actor.enabled) throw Object.assign(new Error('administrator_required'), { status: 403 });
      if (user.objectId !== input.objectId.toLowerCase()) throw new Error('directory_unavailable');
      if (!user.enabled && input.role === 'administrator')
        throw Object.assign(new Error('member_disabled'), { status: 409 });
      return repository.update({ session, settings, ...input });
    },
  };
}
