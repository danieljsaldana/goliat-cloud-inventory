import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_KEY } from '@/core/i18n/config.js';
import { getLocalStorage } from '@/lib/storage.js';
import { loginLocalePath } from '../utils/loginLocalePath.js';

export function useLoginLocale({ locale, target }) {
  const router = useRouter();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next) => {
    if (!Object.hasOwn(LOCALES, next) || next === locale) return;
    try {
      getLocalStorage()?.setItem(LOCALE_KEY, next);
    } catch {
      // El cambio de idioma sigue funcionando si el almacenamiento está bloqueado.
    }
    router.replace(loginLocalePath(target, next), { scroll: false });
  };

  return { setLocale };
}
