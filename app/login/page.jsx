import { redirect } from 'next/navigation';
import { auth } from '../../auth.js';
import { dashboardSessionAllowed, safeReturnPath } from '../../server/access.mjs';
import { authenticationStatus } from '../../server/authentication-status.mjs';
import { translate } from '../../src/core/i18n/translate.js';
import LoginCard from '../../src/features/auth/components/LoginCard/index.jsx';
import AuthConfigurationError from '../../src/features/auth/components/AuthConfigurationError/index.jsx';
import './login.css';
import { getPageMetadata } from '../../src/core/sharing/metadata.js';
import { sharingPageForPath } from '../../src/core/sharing/utils/sharingPageForPath.js';
import { nextPageMetadata } from '../../src/core/sharing/utils/nextPageMetadata.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }) {
  const query = await searchParams;
  const locale = query.locale === 'en' ? 'en' : 'es';
  const siteUrl = process.env.SITE_URL || `http://127.0.0.1:${process.env.PORT || '4000'}/`;
  const target = new URL(safeReturnPath(query.callbackUrl, `/${locale}/`), siteUrl);
  const page =
    sharingPageForPath(target.pathname, siteUrl, locale) || getPageMetadata([], locale, siteUrl);
  return { ...nextPageMetadata(page), title: translate(locale, 'auth.pageTitle') };
}

export default async function LoginPage({ searchParams }) {
  const query = await searchParams;
  const locale = query.locale === 'en' ? 'en' : 'es';
  const target = safeReturnPath(query.callbackUrl, `/${locale}/`);
  const settings = authenticationStatus();
  if (!settings) return <AuthConfigurationError locale={locale} />;
  if (!settings.enabled) redirect(target);
  if (dashboardSessionAllowed(await auth(), settings)) redirect(target);
  return (
    <LoginCard
      mode={settings.mode}
      locale={locale}
      target={target}
      initialError={Boolean(query.error)}
    />
  );
}
