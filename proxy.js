import { NextResponse } from 'next/server';
import { auth } from './auth.js';
import { dashboardSessionAllowed } from './server/access.mjs';
import { authenticationStatus } from './server/authentication-status.mjs';
import { translate } from './src/core/i18n/translate.js';
import { loggedRoute } from './server/logging/request.mjs';
import { logContext } from './server/logging/context.mjs';
import { previewResponse } from './server/sharing/previewResponse.mjs';

function allow(request) {
  const headers = new Headers(request.headers);
  const english =
    /^\/en(?:\/|$)/.test(request.nextUrl.pathname) ||
    (request.nextUrl.pathname === '/login/' && request.nextUrl.searchParams.get('locale') === 'en');
  headers.set('x-inventory-locale', english ? 'en' : 'es');
  const id = logContext.getStore()?.requestId;
  if (id) headers.set('x-request-id', id);
  return NextResponse.next({ request: { headers } });
}

async function evaluateAccess(request) {
  const preview = previewResponse(request);
  if (preview) return preview;
  const path = request.nextUrl.pathname;
  if (/^\/login\/?$/.test(path) || /^\/api\/auth(?:\/|$)/.test(path)) return allow(request);
  const settings = authenticationStatus();
  if (!settings) {
    const locale = /^\/en(?:\/|$)/.test(path) ? 'en' : 'es';
    return new NextResponse(translate(locale, 'auth.unconfiguredDescription'), {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (!settings.enabled) return allow(request);
  const authenticatedProxy = await auth((authenticated) => {
    if (dashboardSessionAllowed(authenticated.auth, settings)) return allow(authenticated);
    if (path.startsWith('/api/'))
      return NextResponse.json(
        { error: 'authentication_required' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    const login = new URL('/login/', settings.url);
    login.searchParams.set('locale', /^\/en(?:\/|$)/.test(path) ? 'en' : 'es');
    login.searchParams.set('callbackUrl', path + request.nextUrl.search);
    return NextResponse.redirect(login);
  });
  return authenticatedProxy(request);
}

export const proxy = loggedRoute(evaluateAccess, { route: 'control-de-acceso', logSuccess: false });

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/hmr(?:/|$)|_next/webpack-hmr(?:/|$)|api/(?:health|ready)(?:/|$)|(?:favicon[.]ico|icon[.]svg|apple-icon[.]png|social/cloud-inventory[.]png)$).*)',
  ],
};
