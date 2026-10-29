import { memberDirectory } from './directory.mjs';
import { membersSettings } from './settings.mjs';
import { objectIdPattern } from './constants.mjs';
import { getLogger } from '../logging/logger.mjs';

export async function handleMemberPhoto(request, objectId, { env = process.env, directory } = {}) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
  if (typeof objectId !== 'string' || !objectIdPattern.test(objectId))
    return new Response(null, { status: 400, headers });
  try {
    membersSettings(env);
    directory ||= memberDirectory({ env });
    const photo = await directory.photo(objectId.toLowerCase(), request.signal);
    if (!photo) return new Response(null, { status: 404, headers });
    return new Response(photo.body, {
      headers: { ...headers, 'Content-Type': photo.contentType },
    });
  } catch (error) {
    getLogger().warn(
      { event: 'members.photo.failed', code: error.code || error.name },
      'No se ha podido cargar la foto del miembro. Se utilizará el icono predeterminado.',
    );
    return new Response(null, { status: 503, headers });
  }
}
