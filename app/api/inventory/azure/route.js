import { getInventory } from '../../../../server/modules/azure/services/inventory.mjs';
import { protectedRoute } from '../../../../server/route-access.mjs';
import { getLogger } from '../../../../server/logging/logger.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = protectedRoute(
  async function GET() {
    try {
      return Response.json(await getInventory(), {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    } catch (error) {
      getLogger().error(
        { err: error, event: 'inventory.unavailable' },
        'No se puede consultar el inventario de Azure.',
      );
      return Response.json({ error: 'inventory_unavailable' }, { status: 503 });
    }
  },
  { route: '/api/inventory/azure/' },
);
