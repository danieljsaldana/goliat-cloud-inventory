import { LOCAL_SITE_URL } from '../constants.js';

export function normalizeSiteUrl(value = LOCAL_SITE_URL) {
  const url = new URL(value || LOCAL_SITE_URL);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('SITE_URL debe ser una URL http(s) sin credenciales, consulta ni fragmento.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}
