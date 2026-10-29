import { useI18n } from '../../../i18n/useI18n.js';
import { Skeleton } from '../../../components/ui/primitives/skeleton.js';

export default function ArchitectureLoading() {
  const { t } = useI18n();
  return (
    <div className="architecture-loading" role="status">
      <span className="sr-only">{t('architecture.loading')}</span>
      <div className="architecture-loading-toolbar" aria-hidden="true">
        <Skeleton className="architecture-loading-title" />
        <Skeleton className="architecture-loading-controls" />
      </div>
      <div className="architecture-loading-diagram" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((node) => (
          <Skeleton key={node} className="architecture-loading-node" />
        ))}
      </div>
    </div>
  );
}
