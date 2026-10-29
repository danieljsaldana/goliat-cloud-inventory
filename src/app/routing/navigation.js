import { parsePagePath } from '../../core/routing/paths.js';
import { LOCAL_SITE_URL } from '../../core/sharing/metadata/constants.js';

export function appBaseUrl() {
  return new URL('/', typeof window === 'undefined' ? LOCAL_SITE_URL : window.location.origin);
}

export function readLocation() {
  return (
    parsePagePath(typeof window === 'undefined' ? '/' : window.location.pathname) || {
      route: ['not-found'],
      locale: 'es',
    }
  );
}
