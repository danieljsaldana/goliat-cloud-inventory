import { useMemo } from 'react';
import Header from '../layout/Header/index.jsx';
import Footer from '../layout/Footer/index.jsx';
import RouteContent from '../RouteContent/index.jsx';
import { useInventory } from '../../features/inventory/hooks/useInventory.js';
import { useSubscription } from '../../features/inventory/hooks/useSubscription.js';
import { listSubscriptions } from '../../core/inventory/subscriptions.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useRoute } from '../routing/useRoute.js';
import { useSignInNotification } from '../../features/auth/hooks/useSignInNotification.js';
import './App.css';

export default function App({ access }) {
  const { t, locale } = useI18n();
  useSignInNotification(Boolean(access?.enabled));
  const route = useRoute(locale);
  const inventory = useInventory();
  const subscriptions = useMemo(() => listSubscriptions(inventory.files), [inventory.files]);
  const [subscription, setSubscription] = useSubscription(subscriptions, inventory.loading);
  function focusMain(event) {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main" onClick={focusMain}>
        {t('nav.skipToContent')}
      </a>
      <Header
        access={access}
        section={route[0] || ''}
        subscriptions={subscriptions}
        subscription={subscription}
        setSubscription={setSubscription}
        loading={inventory.loading}
        inventory={inventory}
      />
      <RouteContent
        access={access}
        route={route}
        inventory={inventory}
        subscription={subscription}
        setSubscription={setSubscription}
      />
      <Footer />
    </div>
  );
}
