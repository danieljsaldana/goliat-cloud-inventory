import Pagination from '../../../../../components/ui/Pagination/index.jsx';
import { useI18n } from '../../../../../i18n/useI18n.js';

export default function TablePagination({ state, label }) {
  const { t } = useI18n();
  const { pageSize, setPageSize, setPage, currentPage, result } = state;
  return (
    <Pagination
      className="table-footer"
      total={result.rows.length}
      label={label}
      currentPage={currentPage}
      pageSize={pageSize}
      setPage={setPage}
      setPageSize={setPageSize}
      pageSizes={[50, 100, 500, 1000]}
      pageSizeLabel={t('table.pageSize')}
    />
  );
}
