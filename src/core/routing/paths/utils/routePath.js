import { DEFAULT_LOCALE, LOCALES } from '../../../i18n/config.js';

export function routePath(route = [], locale = DEFAULT_LOCALE) {
  const language = Object.hasOwn(LOCALES, locale) ? locale : DEFAULT_LOCALE;
  return [language, ...route].join('/') + '/';
}
