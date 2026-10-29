import { getRefreshStatus } from './getRefreshStatus.mjs';

export async function handleRefreshStatus(provider) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    return Response.json(await getRefreshStatus(provider), { headers });
  } catch {
    return Response.json({ error: 'refresh_status_unavailable' }, { status: 503, headers });
  }
}
