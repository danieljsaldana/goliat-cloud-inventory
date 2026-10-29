import { protectedRoute } from '../../../../../../server/route-access.mjs';
import { handleMemberPhoto } from '../../../../../../server/members/handleMemberPhoto.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = protectedRoute(
  async function GET(request, { params }) {
    const { objectId } = await params;
    return handleMemberPhoto(request, objectId);
  },
  { route: '/api/admin/members/[objectId]/photo/', requireAdministrator: true, logSuccess: false },
);
