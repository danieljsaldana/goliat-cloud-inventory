import { useI18n } from '@/i18n/useI18n.js';
import { Card } from '@/components/ui/primitives/card.js';
import Pagination from '@/components/ui/Pagination/index.jsx';
import { usePagination } from '@/components/ui/usePagination.js';
import AppLink from '@/app/routing/AppLink/index.jsx';
import { REPORT_ICONS } from '../../reportIcons.js';

export default function CategoryReports({ reports, files, scope }) {
  const { t, format } = useI18n();
  const pagination = usePagination(reports, 10, scope);
  return (
    <Card
      as="section"
      className="category-reports gap-0 py-0"
      aria-labelledby="category-reports-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="category-reports-title">{t('category.reports')}</h2>
          <p>{t('category.reportsHint')}</p>
        </div>
      </div>
      <div className="category-report-list">
        {pagination.items.map((report) => {
          const Icon = REPORT_ICONS[report.icon];
          return (
            <AppLink
              key={report.id}
              to={`/inventario/${report.id}`}
              className="category-report-link"
            >
              <Icon size={18} aria-hidden="true" />
              <span>{t(report.labelKey)}</span>
              <small>
                {files[report.id]
                  ? t('category.reportRows', { count: format(files[report.id].rows.length) })
                  : t('overview.unavailableService')}
              </small>
            </AppLink>
          );
        })}
      </div>
      <Pagination total={reports.length} label={t('category.reports')} {...pagination} />
    </Card>
  );
}
