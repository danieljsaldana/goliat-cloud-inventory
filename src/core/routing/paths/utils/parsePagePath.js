import { LOCALES } from '../../../i18n/config.js';

export function parsePagePath(pathname, basePath = '/') {
  if (!pathname.startsWith(basePath)) return null;
  const parts = pathname.slice(basePath.length).split('/').filter(Boolean);
  if (parts.at(-1) === 'index.html') parts.pop();
  if (!parts.length) return { route: [], locale: null };
  if (!Object.hasOwn(LOCALES, parts[0])) return null;
  return { locale: parts.shift(), route: parts };
}
