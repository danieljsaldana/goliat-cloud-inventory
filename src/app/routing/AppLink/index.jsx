import { useI18n } from '../../../i18n/useI18n.js';
import Link from 'next/link';
import { routePath } from '../../../core/routing/paths.js';

export default function AppLink({ to = '/', onClick, children, ...props }) {
  const { locale } = useI18n();
  const url = new URL(to, 'https://goliat.internal');
  const route = url.pathname.split('/').filter(Boolean);
  return (
    <Link
      {...props}
      href={'/' + routePath(route, locale) + url.search + url.hash}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
