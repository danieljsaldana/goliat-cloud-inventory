import { Label } from '../primitives/label.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { pageWindow } from '../../../core/pagination/index.js';
import Select from '../Select/index.jsx';
import { Pagination as PaginationRoot } from '../primitives/pagination.js';
import { cn } from '@/lib/utils.js';
import PaginationNavigation from './PaginationNavigation/index.jsx';
import { DEFAULT_PAGE_SIZES } from './constants.js';
import './Pagination.css';

/** @param {import('./types.js').PaginationProps} props */
export default function Pagination({
  total,
  currentPage,
  pageSize,
  setPage,
  setPageSize,
  label,
  pageSizes = DEFAULT_PAGE_SIZES,
  pageSizeLabel,
  showPageSize = true,
  className = '',
}) {
  const { t, format } = useI18n();
  const window = pageWindow(total, currentPage, pageSize);
  return (
    <PaginationRoot
      className={cn(
        'pagination-footer',
        !showPageSize && 'pagination-footer-without-limit',
        className,
      )}
      aria-label={t('pagination.for', { label })}
    >
      <div className="pagination-status" role="status" aria-live="polite" aria-atomic="true">
        <span>
          {t('pagination.range', {
            start: format(window.start),
            end: format(window.end),
            total: format(total),
          })}
        </span>
      </div>
      <PaginationNavigation
        pages={total > 0 ? window.pages : 0}
        currentPage={window.currentPage}
        setPage={setPage}
      />
      {showPageSize && (
        <Label className="pagination-limit">
          {pageSizeLabel || t('pagination.perPage')}
          <Select
            className="pagination-size"
            value={pageSize}
            onValueChange={(value) => setPageSize(Number(value))}
            options={pageSizes.map((size) => ({ value: size, label: format(size) }))}
          />
        </Label>
      )}
    </PaginationRoot>
  );
}
