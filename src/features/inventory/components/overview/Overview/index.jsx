import { useMemo } from 'react';
import { Boxes, Layers, MapPin, Shapes, Tags } from 'lucide-react';
import { sumBy } from '../../../../../core/table/index.js';
import { useI18n } from '../../../../../i18n/useI18n.js';
import { getOverviewData } from '../../../../../core/inventory/overview.js';
import Kpi from '../Kpi/index.jsx';
import ChartCard from '../ChartCard/index.jsx';
import Bars from '../Bars/index.jsx';
import { providerLabel } from '../Bars/utils/providerLabel.js';
import { resourceTypeLabel } from '../Bars/utils/resourceTypeLabel.js';
import DistributionChart from '../DistributionChart/index.jsx';
import ServiceSummary from '../ServiceSummary/index.jsx';
import SubscriptionList from '../SubscriptionList/index.jsx';
import EmptyState from '../../../../../components/ui/EmptyState/index.jsx';
import EmptyChart from '../EmptyChart/index.jsx';
import './Overview.css';

export default function Overview({ files, subscription, setSubscription }) {
  const { t, format } = useI18n();
  const {
    types,
    hasResourceData,
    total,
    providers,
    providerCount,
    locations,
    activeSubscriptions,
    tagged,
    coveragePercent,
    subscriptionEntries,
  } = useMemo(() => getOverviewData(files), [files]);
  return (
    <>
      <div className="overview-toolbar">
        <div className="section-caption">
          <span className="live-dot" />
          {t('overview.environment')}
        </div>
      </div>
      <div className="kpi-grid">
        <Kpi
          label={t('overview.totalResources')}
          value={hasResourceData ? format(total) : '—'}
          note={t('overview.selectedInventory')}
          icon={Boxes}
          accent
        />
        <Kpi
          label={t('overview.resourceProviders')}
          value={!hasResourceData || providerCount === null ? '—' : format(providerCount)}
          note={t('overview.resourceManager')}
          icon={Shapes}
        />
        <Kpi
          label={t('overview.activeSubscriptions')}
          value={format(activeSubscriptions)}
          note={t(subscription ? 'overview.selectedSubscription' : 'overview.allAzureEnvironments')}
          icon={Layers}
        />
        <Kpi
          label={t('reports.tagCoverage')}
          value={coveragePercent === null ? '—' : `${coveragePercent}%`}
          note={
            coveragePercent === null
              ? t('overview.noCoverage')
              : t('overview.taggedResources', { count: format(tagged) })
          }
          icon={Tags}
        />
      </div>
      {hasResourceData && total === 0 && (
        <EmptyState
          icon={Boxes}
          title={t('overview.noResources')}
          description={t('overview.noResourcesHint')}
        />
      )}
      <div className="overview-charts">
        <ChartCard title={t('overview.byProvider')} subtitle={t('overview.providerDescription')}>
          <Bars
            entries={providers}
            formatLabel={providerLabel}
            compact
            label={t('overview.byProvider')}
            scope={subscription}
          />
        </ChartCard>
        <ChartCard title={t('overview.byLocation')} subtitle={t('overview.locationDescription')}>
          {files['resources'] ? (
            <DistributionChart
              entries={locations}
              label={t('overview.byLocation')}
              scope={subscription}
            />
          ) : (
            <EmptyChart message="overview.locationUnavailable" icon={MapPin} />
          )}
        </ChartCard>
      </div>
      <ServiceSummary files={files} scope={subscription} />
      <div className="overview-bottom">
        <SubscriptionList
          entries={subscriptionEntries}
          subscription={subscription}
          setSubscription={setSubscription}
        />
        <ChartCard title={t('overview.resourceTypes')} subtitle={t('overview.topResourceTypes')}>
          <Bars
            entries={sumBy(types, 'type')}
            formatLabel={resourceTypeLabel}
            label={t('overview.resourceTypes')}
            scope={subscription}
            compact
          />
        </ChartCard>
      </div>
    </>
  );
}
