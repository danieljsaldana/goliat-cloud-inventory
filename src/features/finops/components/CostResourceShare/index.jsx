import { useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/primitives/card.js';
import { useI18n } from '@/i18n/useI18n.js';
import { resourceShares } from '@/core/finops/resourceShares.js';
import ResourceShareChart from './ResourceShareChart/index.jsx';
import ResourceShareTable from './ResourceShareTable/index.jsx';

export default function CostResourceShare({ resources, money, scope }) {
  const { t, localeTag } = useI18n();
  const shares = useMemo(() => resourceShares(resources), [resources]);
  const formatter = new Intl.NumberFormat(localeTag, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const percent = (share) => {
    if (share === null) return '—';
    if (share > 0 && share < 0.001)
      return t('finops.smallShare', { percent: formatter.format(0.001) });
    return formatter.format(share);
  };
  return (
    <Card as="section" className="finops-resource-share finops-chart">
      <CardHeader>
        <CardTitle as="h2">{t('finops.resourceShare')}</CardTitle>
        <CardDescription>{t('finops.resourceShareHelp')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="finops-share-layout">
          <div>
            {shares.positiveTotal > 0 ? (
              <ResourceShareChart slices={shares.slices} money={money} percent={percent} />
            ) : (
              <p className="finops-share-empty" role="status">
                {t('finops.noPositiveCosts')}
              </p>
            )}
            <p className="finops-share-note">
              {t('finops.shareBasis', { total: money(shares.positiveTotal) })}
            </p>
            {shares.credits < 0 && (
              <p className="finops-share-note">
                {t('finops.shareCredits', { amount: money(shares.credits) })}
              </p>
            )}
          </div>
          <ResourceShareTable
            entries={shares.entries}
            money={money}
            percent={percent}
            scope={scope}
          />
        </div>
      </CardContent>
    </Card>
  );
}
