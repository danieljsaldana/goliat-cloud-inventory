import { Card } from '@/components/ui/primitives/card.js';
import { Skeleton } from '@/components/ui/primitives/skeleton.js';
import { useI18n } from '@/i18n/useI18n.js';
import '../overview/Overview/Overview.css';
import './InventoryLoading.css';

export default function InventoryLoading({ overview }) {
  const { t } = useI18n();
  return (
    <section
      className="loading-state inventory-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <h2 className="sr-only">{t('dashboard.loadingAzure')}</h2>
      <div aria-hidden="true">
        {overview && (
          <>
            <div className="kpi-grid">
              {[0, 1, 2, 3].map((index) => (
                <Card key={index} className="inventory-skeleton-kpi">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-9 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                </Card>
              ))}
            </div>
            <div className="overview-charts">
              {[0, 1].map((index) => (
                <Card key={index} className="inventory-skeleton-panel">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-56 w-full" />
                  <Skeleton className="h-8 w-full" />
                </Card>
              ))}
            </div>
          </>
        )}
        <Card className="inventory-skeleton-panel inventory-skeleton-table">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
          <Skeleton className="h-8 w-full" />
        </Card>
      </div>
    </section>
  );
}
