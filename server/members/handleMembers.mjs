import { membersService } from './service.mjs';
import { sameOrigin } from '../refresh/utils/sameOrigin.mjs';
import { getLogger } from '../logging/logger.mjs';

const publicErrors = new Set([
  'invalid_member',
  'protected_administrator',
  'self_role_change',
  'administrator_required',
  'role_conflict',
  'member_disabled',
  'members_unconfigured',
  'directory_forbidden',
]);

export async function handleMembers(request, { env = process.env, client } = {}) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (request.method !== 'GET' && !sameOrigin(request, env))
    return Response.json({ error: 'invalid_origin' }, { status: 403, headers });
  try {
    client ||= membersService({ env });
    if (request.method === 'GET')
      return Response.json(await client.read(request.auth, request.signal), { headers });
    if (
      !request.headers.get('content-type')?.startsWith('application/json') ||
      Number(request.headers.get('content-length') || 0) > 2048
    )
      return Response.json({ error: 'invalid_member' }, { status: 400, headers });
    const body = await request.text();
    const input = (() => {
      try {
        if (body.length > 2048) throw new Error();
        return JSON.parse(body);
      } catch {
        throw Object.assign(new Error('invalid_member'), { status: 400 });
      }
    })();
    const result = await client.update(request.auth, input, request.signal);
    return Response.json(result, { headers });
  } catch (error) {
    getLogger().warn(
      { event: 'members.request.failed', code: error.code || error.name },
      'No se ha podido completar la gestión de miembros.',
    );
    const status = [400, 403, 404, 409, 503].includes(error.status) ? error.status : 503;
    return Response.json(
      { error: publicErrors.has(error.message) ? error.message : 'members_unavailable' },
      { status, headers },
    );
  }
}
