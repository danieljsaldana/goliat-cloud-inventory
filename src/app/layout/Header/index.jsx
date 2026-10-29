import AppLink from '../../routing/AppLink/index.jsx';
import SubscriptionSelect from '../../../features/inventory/components/SubscriptionSelect/index.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import './Header.css';
import AccountMenu from '../../../features/auth/AccountMenu/index.jsx';
import MainNavigation from '../MainNavigation/index.jsx';
import MobileNavigation from '../MobileNavigation/index.jsx';
import GlobalSearch from '../../../features/inventory/components/GlobalSearch/index.jsx';

export default function Header({ section, access, inventory, ...scope }) {
  const { t } = useI18n();
  return (
    <header className="site-header">
      <AppLink className="brand" to="/" aria-label={t('nav.brandHome')}>
        <span className="brand-logo" role="img" aria-label={t('brand.logo')} />
        <small>{t('brand.tagline')}</small>
      </AppLink>
      <MainNavigation section={section} administrator={access?.administrator} />
      <div className="header-controls">
        <div className="header-search">
          <GlobalSearch inventory={inventory} setSubscription={scope.setSubscription} />
        </div>
        {section === 'inventario' && (
          <div className="header-context">
            <SubscriptionSelect {...scope} />
          </div>
        )}
        <div className="header-actions">
          <AccountMenu access={access} />
          <MobileNavigation section={section} access={access} />
        </div>
      </div>
    </header>
  );
}
