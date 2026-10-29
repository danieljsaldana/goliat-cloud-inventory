import { ShieldCheck } from 'lucide-react';
import DateLabel from '../../../components/DateLabel/index.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { inventoryStats } from '../utils/inventoryStats.js';
import ProviderCard from '../components/ProviderCard/index.jsx';
import './HomePage.css';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from '@/components/ui/primitives/breadcrumb.js';

export default function HomePage({ inventory }) {
  const { t } = useI18n();
  const stats = inventoryStats(inventory.files);
  const ready = stats.views > 0;
  const available = ready && !inventory.loading;
  return (
    <main id="main" tabIndex={-1} className="home">
      <Breadcrumb className="breadcrumb" aria-label={t('nav.breadcrumb')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{t('common.home')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <section className="home-intro">
        <span className="eyebrow">
          <span />
          {t('home.eyebrow')}
        </span>
        <h1>
          {t('home.title')}
          <br />
          <span>{t('home.subtitle')}</span>
        </h1>
      </section>
      <div className="provider-grid">
        <ProviderCard
          provider="azure"
          loading={inventory.loading}
          ready={ready}
          stats={[
            { label: 'common.resources', value: available ? stats.resources : null },
            {
              label: 'overview.activeSubscriptions',
              value: available ? stats.subscriptions : null,
            },
            { label: 'home.inventoryViews', value: inventory.loading ? null : stats.views },
          ]}
        />
      </div>
      <div className="home-note">
        <ShieldCheck size={18} />
        <span>
          {t('home.note')}
          <small>{t('home.noteDetail')}</small>
        </span>
        <span className="home-date">
          <DateLabel metadata={inventory.metadata} />
        </span>
      </div>
    </main>
  );
}
