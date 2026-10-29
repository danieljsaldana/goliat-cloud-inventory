import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { parsePagePath, routePath } from '../../core/routing/paths.js';
import { readLocale } from '../../core/i18n/config.js';
import { getLocalStorage } from '../../lib/storage.js';

export function useRoute(locale) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname === '/') router.replace('/' + routePath([], readLocale(getLocalStorage())));
  }, [pathname, router, locale]);
  return parsePagePath(pathname)?.route || ['not-found'];
}
