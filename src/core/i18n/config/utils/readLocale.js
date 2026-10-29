import { DEFAULT_LOCALE } from '../constants.js';
import { LOCALE_KEY } from '../constants.js';
import { LOCALES } from '../constants.js';

export function readLocale(storage) {
  try {
    const saved = storage?.getItem(LOCALE_KEY);
    return Object.hasOwn(LOCALES, saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
