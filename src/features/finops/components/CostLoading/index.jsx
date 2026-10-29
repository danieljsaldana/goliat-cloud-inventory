import { Skeleton } from '@/components/ui/primitives/skeleton.js';
import { useI18n } from '@/i18n/useI18n.js';

export default function CostLoading() {
  const { t } = useI18n();
  return (
    <div className="finops-loading" role="status" aria-label={t('finops.loading')}>
      <Skeleton className="h-28 w-full" />
      <div className="finops-charts">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
