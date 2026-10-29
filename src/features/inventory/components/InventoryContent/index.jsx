import { Button } from '../../../../components/ui/primitives/button.js';
import AppLink from '../../../../app/routing/AppLink/index.jsx';
import { Cloud, FolderClosed } from 'lucide-react';
import InventoryLoading from '../InventoryLoading/index.jsx';
import { unavailableReportDescription } from '../../utils/unavailableReportDescription.js';
import EmptyState from '../../../../components/ui/EmptyState/index.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { REPORTS } from '../../../../core/inventory/reports.js';
import DataTable from '../DataTable/index.jsx';
import Overview from '../overview/Overview/index.jsx';
import { useSearchParams } from 'next/navigation';
import { CATEGORY_SUMMARIES } from '@/core/inventory/categories.js';
import CategoryOverview from '../CategoryOverview/index.jsx';

export default function InventoryContent({
  inventory,
  files,
  reportId,
  subscription,
  setSubscription,
}) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const summary = CATEGORY_SUMMARIES.find(({ id }) => id === reportId);
  if (inventory.loading) return <InventoryLoading overview={!reportId || Boolean(summary)} />;
  if (summary)
    return (
      <CategoryOverview
        key={`${summary.id}:${subscription}`}
        group={summary.group}
        files={files}
        subscription={subscription}
        setSubscription={setSubscription}
      />
    );

  if (reportId) {
    if (files[reportId])
      return (
        <DataTable
          key={`${reportId}:${searchParams.get('q') || ''}`}
          file={files[reportId]}
          id={reportId}
          subscription={subscription}
          initialSearch={searchParams.get('q') || ''}
        />
      );
    const report = REPORTS.find((item) => item.id === reportId);
    const missingTagDependency = subscription && reportId === 'tags' && inventory.files[reportId];
    const descriptionKey = unavailableReportDescription(missingTagDependency, report);
    return (
      <EmptyState
        icon={FolderClosed}
        title={t(report ? 'dashboard.unavailableView' : 'dashboard.unknownView')}
        description={t(descriptionKey)}
      >
        <Button asChild>
          <AppLink to="/inventario">{t('dashboard.backToOverview')}</AppLink>
        </Button>
      </EmptyState>
    );
  }

  if (Object.keys(inventory.files).length)
    return <Overview files={files} subscription={subscription} setSubscription={setSubscription} />;

  return (
    <EmptyState
      icon={Cloud}
      title={t('dashboard.noInventory')}
      description={t('dashboard.reloadHint')}
    >
      <Button variant="default" size="default" className="" onClick={inventory.reload}>
        {t('common.retry')}
      </Button>
    </EmptyState>
  );
}
