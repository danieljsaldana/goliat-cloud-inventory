import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { auth } from '../../auth.js';
import { authenticationSettings, dashboardSessionAllowed } from '../../server/access.mjs';
import DashboardClient from '../DashboardClient.jsx';
import { isPageRoute } from '../../src/core/routing/paths.js';
import { getPageMetadata } from '../../src/core/sharing/metadata.js';
import { nextPageMetadata } from '../../src/core/sharing/utils/nextPageMetadata.js';
import { applicationAdministrator } from '../../server/access/applicationAdministrator.mjs';

export const dynamic = 'force-dynamic';

async function resolvePage(params) {
  const { path = [] } = await params;
  const locale = path[0] || 'es';
  const route = path.slice(1);
  if (!['es', 'en'].includes(locale) || !isPageRoute(route)) notFound();
  return { locale, route };
}

export async function generateMetadata({ params }) {
  const { locale, route } = await resolvePage(params);
  const page = getPageMetadata(
    route,
    locale,
    process.env.SITE_URL || `http://127.0.0.1:${process.env.PORT || '4000'}/`,
  );
  return nextPageMetadata(page);
}

export default async function Page({ params }) {
  const { locale, route } = await resolvePage(params);
  const settings = authenticationSettings();
  const session = settings.enabled ? await auth() : null;
  if (!dashboardSessionAllowed(session, settings)) redirect(`/login/?locale=${locale}`);
  if (route[0] === 'profile' && !session) notFound();
  const administrator = await applicationAdministrator(session, settings);
  if (['admin', 'members'].includes(route[0]) && !administrator) notFound();
  return (
    <DashboardClient
      locale={locale}
      access={{
        enabled: settings.enabled,
        administrator,
        name: session?.user?.name || '',
        email: session?.user?.email || '',
        image: session?.user?.image || null,
      }}
    />
  );
}
