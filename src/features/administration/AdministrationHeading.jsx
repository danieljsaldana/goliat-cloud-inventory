import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Button } from '../../components/ui/primitives/button.js';
import { Spinner } from '../../components/ui/primitives/spinner.js';

export default function AdministrationHeading({ loading, checkedAt, reload, date }) {
  const { t } = useI18n();
  return (
    <header className="admin-heading">
      <div className="admin-heading-copy">
        <span className="eyebrow">
          <ShieldCheck size={15} aria-hidden="true" /> {t('admin.eyebrow')}
        </span>
        <h1>{t('admin.title')}</h1>
        <p>{t('admin.description')}</p>
      </div>
      <div className="admin-query">
        <Button
          variant="outline"
          className="admin-refresh"
          onClick={reload}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? <Spinner /> : <RefreshCw size={16} aria-hidden="true" />}
          {t(loading ? 'admin.loading' : 'admin.refresh')}
        </Button>
        <p className="admin-query-note" role="status" aria-live="polite">
          {loading && t(checkedAt ? 'admin.updatingHelp' : 'admin.loadingHelp')}
          {!loading && checkedAt && `${t('admin.checkedAt')}: ${date(checkedAt)}`}
        </p>
      </div>
    </header>
  );
}
