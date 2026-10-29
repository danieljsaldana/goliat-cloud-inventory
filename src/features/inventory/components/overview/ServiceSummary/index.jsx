import { Card } from '../../../../../components/ui/primitives/card.js';
import AppLink from '../../../../../app/routing/AppLink/index.jsx';
import { useMemo } from 'react';
import './ServiceSummary.css';
import { ArrowUpRight, Server } from 'lucide-react';
import { useI18n } from '../../../../../i18n/useI18n.js';
import Pagination from '../../../../../components/ui/Pagination/index.jsx';
import { usePagination } from '../../../../../components/ui/usePagination.js';
import { useGridColumns } from '../../../../../components/ui/useGridColumns.js';
import { gridRows } from '../../../../../core/pagination/index.js';

import { DEFAULT_ROWS_PER_PAGE, INITIAL_COLUMNS, ROW_PAGE_SIZES, SERVICES } from './constants.js';

export default function ServiceSummary({ files, scope }) {
  const { t, format } = useI18n();
  const { gridRef, columns } = useGridColumns(INITIAL_COLUMNS);
  const rows = useMemo(() => gridRows(SERVICES, columns), [columns]);
  const pagination = usePagination(rows, DEFAULT_ROWS_PER_PAGE, `${scope || ''}:${columns}`);
  return (
    <Card as="section" className="service-panel gap-0 py-0">
      <div className="panel-heading">
        <div>
          <h2>{t('overview.services')}</h2>
          <p>{t('overview.servicesDescription')}</p>
        </div>
        <Server size={18} />
      </div>
      <div className="service-grid" ref={gridRef}>
        {pagination.items.flat().map(([label, id, Icon]) => (
          <AppLink
            to={`/inventario/${id}`}
            className={`service-item ${!files[id]?.rows.length ? 'service-item-empty' : ''}`}
            key={id}
          >
            <span className="service-icon">
              <Icon size={20} />
            </span>
            <div>
              <strong>{files[id] ? format(files[id].rows.length) : '—'}</strong>
              <span>{t(label)}</span>
              {!files[id]?.rows.length && (
                <small className="service-status">
                  {t(files[id] ? 'overview.emptyService' : 'overview.unavailableService')}
                </small>
              )}
            </div>
            <ArrowUpRight size={15} />
          </AppLink>
        ))}
      </div>
      <Pagination
        total={SERVICES.length}
        label={t('overview.services')}
        {...pagination}
        pageSizes={ROW_PAGE_SIZES.map((rowCount) => rowCount * columns)}
        pageSize={pagination.pageSize * columns}
        setPageSize={(size) => pagination.setPageSize(size / columns)}
      />
    </Card>
  );
}
