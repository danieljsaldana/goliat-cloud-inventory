import es from '../../locales/es.js';
import { DEFAULT_LOCALE } from '../../config.js';
import { catalogs } from '../constants.js';

export function translate(locale, key, values = {}) {
  const catalog = Object.hasOwn(catalogs, locale) ? catalogs[locale] : catalogs[DEFAULT_LOCALE];
  const fallback = Object.hasOwn(es, key) ? es[key] : key;
  const text = Object.hasOwn(catalog, key) ? catalog[key] : fallback;
  return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
