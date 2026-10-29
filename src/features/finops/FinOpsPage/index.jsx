import { useCallback, useMemo, useState } from 'react';
import { CircleAlert, RefreshCw, Wallet } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n.js';
import { useAsyncResource } from '@/hooks/useAsyncResource.js';
import { Button } from '@/components/ui/primitives/button.js';
import { Badge } from '@/components/ui/primitives/badge.js';
import { Alert, AlertDescription } from '@/components/ui/primitives/alert.js';
import { Spinner } from '@/components/ui/primitives/spinner.js';
import EmptyState from '@/components/ui/EmptyState/index.jsx';
import { costPeriod } from '@/core/finops/period.js';
import { summarizeCosts } from '@/core/finops/summary.js';
import { loadCosts } from '../api/costs.js';
import CostFilters from '../components/CostFilters/index.jsx';
import CostSummary from '../components/CostSummary/index.jsx';
import CostTimeline from '../components/CostTimeline/index.jsx';
import CostDistribution from '../components/CostDistribution/index.jsx';
import CostResourceShare from '../components/CostResourceShare/index.jsx';
import CostResources from '../components/CostResources/index.jsx';
import CostAvailability from '../components/CostAvailability/index.jsx';
import CostLoading from '../components/CostLoading/index.jsx';
import './FinOpsPage.css';

export default function FinOpsPage({ inventory, setSubscription: setInventorySubscription }) {
  const { t, localeTag } = useI18n();
  const [month, setMonth] = useState(() => costPeriod().month);
  const [basis, setBasis] = useState('ActualCost');
  const [subscription, setSubscription] = useState('');
  const [currency, setCurrency] = useState('');
  const [group, setGroup] = useState('serviceName');
  const load = useCallback((signal) => loadCosts(month, basis, signal), [month, basis]);
  const { data, loading, error, reload } = useAsyncResource(load);
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
      return {
        value: date.toISOString().slice(0, 7),
        label: new Intl.DateTimeFormat(localeTag, {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(date),
      };
    });
  }, [localeTag]);
  const selected = data?.subscriptions.some(({ id }) => id === subscription) ? subscription : '';
  const summary = useMemo(
    () => (data ? summarizeCosts(data, { subscription: selected, currency, group }) : null),
    [data, selected, currency, group],
  );
  const money = (amount) =>
    new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: summary.currency,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount);
  const checkedAt =
    data?.checkedAt &&
    new Intl.DateTimeFormat(localeTag, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(data.checkedAt),
    );
  const hasCosts = Boolean(summary?.rows.length);
  const scope = `${month}:${basis}:${selected}:${summary?.currency || ''}`;
  return (
    <main id="main" tabIndex={-1} className="finops-page">
      <header className="finops-heading">
        <div>
          <h1>{t('finops.title')}</h1>
          <p>{t('finops.description')}</p>
        </div>
        <Button variant="outline" disabled={loading} onClick={reload} aria-busy={loading}>
          {loading ? <Spinner /> : <RefreshCw size={16} aria-hidden="true" />}
          {t('finops.refresh')}
        </Button>
      </header>
      <CostFilters
        month={month}
        basis={basis}
        subscription={selected}
        currency={summary?.currency || ''}
        months={months}
        subscriptions={data?.subscriptions || []}
        currencies={summary?.currencies || []}
        onMonth={setMonth}
        onBasis={setBasis}
        onSubscription={setSubscription}
        onCurrency={setCurrency}
        loading={loading}
      />
      <p className="finops-basis-help">
        {t(basis === 'ActualCost' ? 'finops.actualHelp' : 'finops.amortizedHelp')}
      </p>
      {loading && <CostLoading />}
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{t('finops.error')}</AlertDescription>
        </Alert>
      )}
      {!loading && data && (
        <>
          <div className="finops-source">
            <Badge variant="secondary">{t('finops.source')}</Badge>
            <span>{t('finops.checkedAt', { date: checkedAt })}</span>
          </div>
          <CostAvailability subscriptions={summary.subscriptions} />
          {data.status === 'not-configured' && (
            <EmptyState
              icon={Wallet}
              title={t('finops.notConfigured')}
              description={t('finops.notConfiguredHelp')}
            />
          )}
          {data.status !== 'not-configured' && !hasCosts && (
            <EmptyState
              icon={Wallet}
              title={t(
                summary.subscriptions.some(({ status }) => status === 'ready')
                  ? 'finops.empty'
                  : 'finops.unavailable',
              )}
              description={t(
                summary.subscriptions.some(({ status }) => status === 'ready')
                  ? 'finops.emptyHelp'
                  : 'finops.unavailableHelp',
              )}
            />
          )}
          {hasCosts && (
            <>
              <CostSummary summary={summary} money={money} />
              <div className="finops-charts">
                <CostTimeline entries={summary.daily} money={money} />
                <CostDistribution
                  entries={summary.groups}
                  group={group}
                  onGroup={setGroup}
                  money={money}
                  scope={scope}
                />
              </div>
              <CostResourceShare resources={summary.resources} money={money} scope={scope} />
              <CostResources
                entries={summary.resources}
                money={money}
                inventory={inventory}
                setSubscription={setInventorySubscription}
                scope={scope}
              />
            </>
          )}
          <p className="finops-footnote">{t('finops.dataNote')}</p>
        </>
      )}
    </main>
  );
}
