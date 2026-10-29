import { useI18n } from '@/i18n/useI18n.js';
import { pageItems } from '@/core/pagination/index.js';
import { cn } from '@/lib/utils.js';
import {
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/primitives/pagination.js';
import PaginationPageItem from '../PaginationPageItem/index.jsx';

/** @param {import('../types.js').PaginationNavigationProps} props */
export default function PaginationNavigation({ pages, currentPage, setPage }) {
  const { t, format } = useI18n();
  const items = pageItems(pages, currentPage);
  const previousLabel = t('table.previousPage');
  const nextLabel = t('table.nextPage');
  return (
    <div className="pagination-navigation">
      <PaginationContent className="pagination-actions">
        <PaginationItem>
          <PaginationPrevious
            as="button"
            iconOnly
            text={previousLabel}
            aria-label={previousLabel}
            title={previousLabel}
            disabled={pages === 0 || currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          />
        </PaginationItem>
        {items.map((item) => (
          <PaginationPageItem
            key={item.key}
            item={item}
            pages={pages}
            currentPage={currentPage}
            setPage={setPage}
          />
        ))}
        <PaginationItem>
          <PaginationNext
            as="button"
            iconOnly
            text={nextLabel}
            aria-label={nextLabel}
            title={nextLabel}
            disabled={pages === 0 || currentPage >= pages - 1}
            onClick={() => setPage(currentPage + 1)}
          />
        </PaginationItem>
      </PaginationContent>
      <span className={cn('pagination-page', pages > 0 && 'sr-only')}>
        {pages > 0
          ? t('table.page', { page: format(currentPage + 1), pages: format(pages) })
          : t('pagination.empty')}
      </span>
    </div>
  );
}
