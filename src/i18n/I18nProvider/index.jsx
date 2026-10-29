import { useEffect, useMemo, useState } from 'react';
import { I18nContext } from '../I18nContext.js';
import { LOCALES, LOCALE_KEY, readLocale } from '../../core/i18n/config.js';
import { translate } from '../../core/i18n/translate.js';
import { getLocalStorage } from '../../lib/storage.js';
import { readLocation } from '../../app/routing/navigation.js';
import { pageLocale } from '../../core/routing/paths.js';
import { usePathname, useRouter } from 'next/navigation';
import { parsePagePath, routePath } from '../../core/routing/paths.js';

export default function I18nProvider({ children, initialLocale = 'es' }) {
  const [locale, setLocale] = useState(initialLocale);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setLocale(parsePagePath(pathname)?.locale || initialLocale);
  }, [pathname, initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    const syncPage = () => {
      setLocale(pageLocale(readLocation(), readLocale(getLocalStorage())));
    };
    const sync = (event) => {
      if (
        event.storageArea === getLocalStorage() &&
        (event.key === LOCALE_KEY || event.key === null)
      ) {
        const next = readLocale(getLocalStorage());
        setLocale(next);
        router.replace('/' + routePath(readLocation().route, next));
      }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('popstate', syncPage);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('popstate', syncPage);
    };
  }, [router]);

  const value = useMemo(
    () => ({
      locale,
      localeTag: LOCALES[locale],
      t: (key, values) => translate(locale, key, values),
      format: (number) => Number(number).toLocaleString(LOCALES[locale]),
      setLocale(next) {
        if (!Object.hasOwn(LOCALES, next)) return;
        setLocale(next);
        router.push('/' + routePath(readLocation().route, next));
        try {
          getLocalStorage()?.setItem(LOCALE_KEY, next);
        } catch {
          /* Mantener la preferencia en memoria si el almacenamiento está bloqueado. */
        }
      },
    }),
    [locale, router],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
