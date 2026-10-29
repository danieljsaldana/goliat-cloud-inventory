import { protectedRoute } from '../../../../server/route-access.mjs';
import { handleCosts } from '../../../../server/finops/handleCosts.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = protectedRoute(handleCosts, { route: '/api/finops/costs/' });
