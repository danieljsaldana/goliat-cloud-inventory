import { required } from './required.mjs';
import { authenticationUrl } from './authenticationUrl.mjs';
import { guid } from '../constants.mjs';
import { AuthConfigurationError } from '../errors.mjs';

export function authenticationSettings(env = process.env) {
  const enabled = env.DASHBOARD_AUTH_ENABLED ?? 'true';
  if (!['true', 'false'].includes(enabled))
    throw new AuthConfigurationError('DASHBOARD_AUTH_ENABLED debe ser true o false.');
  if (enabled === 'false') return { enabled: false };
  const mode = env.DASHBOARD_AUTH_MODE || 'demo';
  if (!['demo', 'azure-ad'].includes(mode))
    throw new AuthConfigurationError('DASHBOARD_AUTH_MODE debe ser demo o azure-ad.');
  const secret = required('AUTH_SECRET', env);
  if (Buffer.byteLength(secret) < 32)
    throw new AuthConfigurationError('AUTH_SECRET necesita al menos 32 bytes.');
  const url = authenticationUrl(required('AUTH_URL', env));
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && (local || env.NODE_ENV !== 'production')))
  )
    throw new AuthConfigurationError('AUTH_URL necesita HTTPS, salvo en desarrollo o localhost.');
  const settings = {
    enabled: true,
    mode,
    secret,
    url: url.origin,
    secureCookies: url.protocol === 'https:',
  };
  if (mode === 'demo') {
    settings.username = required('DASHBOARD_USERNAME', env);
    required('DASHBOARD_PASSWORD', env);
    settings.password = env.DASHBOARD_PASSWORD;
  } else {
    settings.clientId = required('AUTH_MICROSOFT_ENTRA_ID_ID', env);
    settings.clientSecret = required('AUTH_MICROSOFT_ENTRA_ID_SECRET', env);
    settings.issuer = required('AUTH_MICROSOFT_ENTRA_ID_ISSUER', env).replace(/\/$/, '');
    const match = settings.issuer.match(/^https:\/\/login\.microsoftonline\.com\/([^/]+)\/v2\.0$/);
    if (!guid.test(settings.clientId) || !match || !guid.test(match[1]))
      throw new AuthConfigurationError(
        'Azure AD requiere un client ID y un issuer de un tenant concreto.',
      );
    settings.tenantId = match[1].toLowerCase();
  }
  return settings;
}
