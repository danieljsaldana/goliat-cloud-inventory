import { isPageRoute, parsePagePath } from '../../routing/paths.js';
import { getPageMetadata, normalizeSiteUrl } from '../metadata.js';

export function sharingPageForPath(pathname, siteUrl, locale = 'es') {
  const page = parsePagePath(pathname, normalizeSiteUrl(siteUrl).pathname);
  if (!page || !isPageRoute(page.route)) return null;
  return getPageMetadata(page.route, page.locale || locale, siteUrl);
}
