import { protectedRoute } from '../../../../server/route-access.mjs';
import { handleAdministration } from '../../../../server/administration/handleAdministration.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const options = { route: '/api/admin/function/', requireAdministrator: true };
export const GET = protectedRoute(handleAdministration, { ...options, logSuccess: false });
export const POST = protectedRoute(handleAdministration, options);
