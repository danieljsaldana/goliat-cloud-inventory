import { PAGINATION_NEIGHBOR_RANGE, PAGINATION_VISIBLE_PAGE_LIMIT } from '../constants.js';

export function pageItems(pages, currentPage) {
  if (pages < 1) return [];
  const current = Math.max(0, Math.min(currentPage, pages - 1));
  const start = Math.max(0, Math.min(current - 1, pages - PAGINATION_NEIGHBOR_RANGE));
  const end = start + PAGINATION_NEIGHBOR_RANGE - 1;
  const before = start === 2 ? 1 : 'previous-gap';
  const after = end === pages - 3 ? pages - 2 : 'next-gap';
  const range = [
    ...(start > 0 ? [0] : []),
    ...(start > 1 ? [before] : []),
    ...Array.from({ length: PAGINATION_NEIGHBOR_RANGE }, (_, index) => start + index),
    ...(end < pages - 2 ? [after] : []),
    ...(end < pages - 1 ? [pages - 1] : []),
  ];
  const items =
    pages <= PAGINATION_VISIBLE_PAGE_LIMIT
      ? Array.from({ length: pages }, (_, index) => index)
      : range;
  return items.map((page) => {
    if (typeof page === 'number') return { type: 'page', page, key: `page-${page}` };
    return { type: 'ellipsis', key: page };
  });
}
