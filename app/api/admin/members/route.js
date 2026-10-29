import { protectedRoute } from '../../../../server/route-access.mjs';
import { handleMembers } from '../../../../server/members/handleMembers.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const options = { route: '/api/admin/members/', requireAdministrator: true };
export const GET = protectedRoute(handleMembers, { ...options, logSuccess: false });
export const POST = protectedRoute(handleMembers, options);
