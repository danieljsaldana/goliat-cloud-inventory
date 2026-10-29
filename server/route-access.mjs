import { auth } from '../auth.js';
import { dashboardSessionAllowed } from './access.mjs';
import { authenticationStatus } from './authentication-status.mjs';
import { loggedRoute } from './logging/request.mjs';
import { applicationAdministrator } from './access/applicationAdministrator.mjs';

export function protectedRoute(handler, options) {
  return loggedRoute(async (request, context) => {
    const settings = authenticationStatus();
    if (!settings) {
      return Response.json(
        { error: 'auth_unconfigured' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (!settings.enabled) {
      if (options?.requireSession || options?.requireAdministrator)
        return Response.json(
          { error: 'authentication_required' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        );
      return handler(request, context);
    }
    const authenticatedHandler = await auth(async (authenticated) => {
      if (!dashboardSessionAllowed(authenticated.auth, settings))
        return Response.json(
          { error: 'authentication_required' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        );
      if (
        options?.requireAdministrator &&
        !(await applicationAdministrator(authenticated.auth, settings))
      )
        return Response.json(
          { error: 'administrator_required' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } },
        );
      return handler(authenticated, context);
    });
    return authenticatedHandler(request, context);
  }, options);
}
