import { refreshAzure } from '../../../../../server/modules/azure/services/refreshAzure.mjs';
import { protectedRoute } from '../../../../../server/route-access.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = protectedRoute(
  async function GET(request) {
    return refreshAzure(request);
  },
  { route: '/api/inventory/azure/refresh/', logSuccess: false, requireSession: true },
);

export const POST = protectedRoute(
  async function POST(request) {
    return refreshAzure(request);
  },
  { route: '/api/inventory/azure/refresh/', requireSession: true },
);
