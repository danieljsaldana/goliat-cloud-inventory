import { useMemo, useState } from 'react';
import { tableView } from '../../../../core/table/index.js';
import { usePagination } from '../../../../components/ui/usePagination.js';

export function useDataTable(file, subscription, initialSearch = '') {
  const [search, setSearch] = useState(initialSearch),
    [filters, setFilters] = useState({}),
    [groupBy, setGroupBy] = useState('');
  const [sort, setSort] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const result = useMemo(
    () => tableView(file, { search, filters, groupBy, sort }),
    [file, search, filters, groupBy, sort],
  );
  const pagination = usePagination(result.rows, 100, subscription);
  const { setPage } = pagination;
  const filtered = Boolean(search || groupBy || Object.values(filters).some(Boolean));
  function clear() {
    setSearch('');
    setFilters({});
    setGroupBy('');
    setSort(null);
    setPage(0);
  }
  function sortColumn(key) {
    setSort((previous) => ({ key, direction: previous?.key === key ? -previous.direction : 1 }));
    setPage(0);
  }

  return {
    search,
    setSearch,
    filters,
    setFilters,
    groupBy,
    setGroupBy,
    sort,
    ...pagination,
    showFilters,
    setShowFilters,
    result,
    filtered,
    clear,
    sortColumn,
    setPage,
  };
}
