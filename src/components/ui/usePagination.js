import { useEffect, useState } from 'react';
import { pageWindow } from '../../core/pagination/index.js';

export function usePagination(items, initialPageSize, resetKey = '') {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const window = pageWindow(items.length, page, pageSize);

  useEffect(() => {
    setPage(0);
  }, [resetKey]);
  useEffect(() => {
    setPage((current) => pageWindow(items.length, current, pageSize).currentPage);
  }, [items.length, pageSize]);

  return {
    ...window,
    pageSize,
    setPage,
    setPageSize(size) {
      setPageSize(size);
      setPage(0);
    },
    items: items.slice(window.offset, window.end),
  };
}
