import { handlers } from '../../../../auth.js';
import { authenticationSettings } from '../../../../server/access.mjs';
import { loggedRoute } from '../../../../server/logging/request.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request, context) {
  try {
    if (!authenticationSettings().enabled)
      return Response.json({ error: 'auth_disabled' }, { status: 404 });
  } catch {
    return Response.json({ error: 'auth_unconfigured' }, { status: 503 });
  }
  return handlers[request.method](request, context);
}

const loggedHandle = loggedRoute(handle, { route: '/api/auth/[...nextauth]/' });
export { loggedHandle as GET, loggedHandle as POST };
