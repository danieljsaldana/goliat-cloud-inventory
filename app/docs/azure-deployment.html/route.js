import { architectureDocument } from '../../../server/architecture/document.mjs';
import { protectedRoute } from '../../../server/route-access.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = protectedRoute(
  (request) => architectureDocument(request, { diagram: 'azure' }),
  { route: 'arquitectura-azure' },
);
