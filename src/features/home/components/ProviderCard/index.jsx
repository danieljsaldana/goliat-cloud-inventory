import { ArrowRight } from 'lucide-react';
import AppLink from '../../../../app/routing/AppLink/index.jsx';
import Badge from '../../../../components/ui/Badge/index.jsx';
import ProviderMark from '../../../../components/branding/ProviderMark/index.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import ProviderStat from '../ProviderStat/index.jsx';
import { Card } from '@/components/ui/primitives/card.js';
import { Button } from '@/components/ui/primitives/button.js';

export default function ProviderCard({ provider, loading = false, ready, stats }) {
  const { t } = useI18n();
  const availableKey = ready ? 'common.available' : 'common.noData';
  const statusKey = loading ? 'common.loading' : availableKey;
  const exploreKey = 'home.exploreInventory';
  return (
    <Card
      as={AppLink}
      className={`provider-card ${provider}-card gap-0 py-0`}
      to="/inventario"
      aria-label={t(exploreKey)}
    >
      <div className="provider-card-top">
        <ProviderMark provider={provider} large />
        <Badge muted={!ready || loading}>{t(statusKey)}</Badge>
      </div>
      <span className="provider-vendor">{t(`providers.${provider}Vendor`)}</span>
      <h2>{t('inventory.title')}</h2>
      <p>{t(`home.${provider}Description`)}</p>
      <div className="provider-stats">
        {stats.map((stat) => (
          <ProviderStat key={stat.label} {...stat} />
        ))}
      </div>
      <Button asChild>
        <span className="provider-link">
          {t(exploreKey)}
          <ArrowRight size={18} aria-hidden="true" />
        </span>
      </Button>
    </Card>
  );
}
