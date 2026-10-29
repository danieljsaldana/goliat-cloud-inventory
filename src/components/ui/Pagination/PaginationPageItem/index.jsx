import { useI18n } from '@/i18n/useI18n.js';
import {
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/primitives/pagination.js';

/** @param {import('../types.js').PaginationPageItemProps} props */
export default function PaginationPageItem({ item, pages, currentPage, setPage }) {
  const { t, format } = useI18n();
  if (item.type === 'ellipsis')
    return (
      <PaginationItem>
        <PaginationEllipsis label={t('pagination.morePages')} />
      </PaginationItem>
    );
  const isActive = item.page === currentPage;
  const isContext = !isActive && item.page !== 0 && item.page !== pages - 1;
  return (
    <PaginationItem data-context={isContext}>
      <PaginationLink
        as="button"
        isActive={isActive}
        aria-label={t('pagination.goToPage', { page: format(item.page + 1) })}
        onClick={() => setPage(item.page)}
      >
        {format(item.page + 1)}
      </PaginationLink>
    </PaginationItem>
  );
}
