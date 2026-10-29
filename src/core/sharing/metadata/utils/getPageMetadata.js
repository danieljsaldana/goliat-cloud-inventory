import { REPORTS } from '../../../inventory/reports.js';
import { CATEGORY_SUMMARIES } from '../../../inventory/categories.js';
import { translate } from '../../../i18n/translate.js';
import { LOCALES } from '../../../i18n/config.js';
import { isPageRoute, routePath } from '../../../routing/paths.js';
import { pageCopy } from '../../utils/pageCopy.js';
import { normalizeSiteUrl } from './normalizeSiteUrl.js';
import { SOCIAL_IMAGE } from '../constants.js';
import { LOCAL_SITE_URL } from '../constants.js';

export function getPageMetadata(route = [], locale = 'es', siteUrl = LOCAL_SITE_URL) {
  const language = Object.hasOwn(LOCALES, locale) ? locale : 'es';
  const t = (key, values) => translate(language, key, values);
  const report =
    route[0] === 'inventario' &&
    [...REPORTS, ...CATEGORY_SUMMARIES].find(({ id }) => id === route[1]);
  const valid = isPageRoute(route);
  const { title, description } = pageCopy({ route, language, valid, report });
  const base = normalizeSiteUrl(siteUrl);
  return {
    title: route.length > 0 ? `${title} · ${t('brand.name')}` : title,
    description,
    siteName: t('brand.name'),
    locale: language,
    ogLocale: LOCALES[language].replace('-', '_'),
    url: new URL(routePath(route, language), base).href,
    image: new URL(SOCIAL_IMAGE.path, base).href,
    imageAlt: t('sharing.imageAlt'),
    robots: 'noindex, nofollow',
    alternates: Object.keys(LOCALES).map((id) => ({
      locale: id,
      url: new URL(routePath(route, id), base).href,
    })),
    noscript: t('sharing.noscript'),
  };
}
