import { assertSchemaReady } from '../../../server/database/status.mjs';
import { getLogger } from '../../../server/logging/logger.mjs';
import { loggedRoute } from '../../../server/logging/request.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = loggedRoute(
  async function GET() {
    try {
      await assertSchemaReady();
      return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      getLogger().error(
        { err: error, event: 'readiness.failed' },
        'El servicio todavía no está preparado para recibir tráfico.',
      );
      return Response.json(
        { status: 'not_ready' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  },
  { route: '/api/ready/', health: true },
);
