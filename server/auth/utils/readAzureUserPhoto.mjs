import { AZURE_USER_PHOTO_TIMEOUT_MS, AZURE_USER_PHOTO_URL } from '../constants.mjs';
import { getLogger } from '../../logging/logger.mjs';

export async function readAzureUserPhoto(accessToken, request = fetch) {
  if (!accessToken) return null;
  try {
    const response = await request(AZURE_USER_PHOTO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(AZURE_USER_PHOTO_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const image = Buffer.from(await response.arrayBuffer());
    if (!image.length) return null;
    return `data:image/jpeg;base64,${image.toString('base64')}`;
  } catch (error) {
    getLogger().warn(
      { err: error, event: 'authentication.photo.failed' },
      'No se pudo obtener la foto del usuario. Se utilizará el avatar predeterminado.',
    );
    return null;
  }
}
