'use client';

import App from '../src/app/App/index.jsx';
import I18nProvider from '../src/i18n/I18nProvider/index.jsx';
import Toaster from '../src/components/ui/Toaster/index.jsx';

export default function DashboardClient({ locale, access }) {
  return (
    <I18nProvider initialLocale={locale}>
      <Toaster />
      <App access={access} />
    </I18nProvider>
  );
}
