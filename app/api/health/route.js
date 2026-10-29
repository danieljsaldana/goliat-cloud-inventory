import { loggedRoute } from '../../../server/logging/request.mjs';

export const runtime = 'nodejs';
export const GET = loggedRoute(
  function GET() {
    return Response.json({ status: 'ok' });
  },
  { route: '/api/health/', health: true },
);
