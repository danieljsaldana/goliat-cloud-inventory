import { DEFAULT_LOCALE, LOCALES } from '../../../i18n/config.js';

export function pageLocale(page, preferredLocale = DEFAULT_LOCALE) {
  return (
    page.locale || (Object.hasOwn(LOCALES, preferredLocale) ? preferredLocale : DEFAULT_LOCALE)
  );
}
