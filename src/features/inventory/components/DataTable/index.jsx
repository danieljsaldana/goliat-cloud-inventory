import { Card } from '../../../../components/ui/primitives/card.js';
import { useMemo } from 'react';
import { Boxes } from 'lucide-react';
import { columnLabel, isNumericColumn } from '../../../../core/table/index.js';
import { REPORTS } from '../../../../core/inventory/reports.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { useDataTable } from './useDataTable.js';
import TableToolbar from './TableToolbar/index.jsx';
import TablePagination from './TablePagination/index.jsx';
import TableHead from './TableHead/index.jsx';
import TableBody from './TableBody/index.jsx';
import NoTableResults from './NoTableResults/index.jsx';
import EmptyState from '../../../../components/ui/EmptyState/index.jsx';
import './DataTable.css';
import { Table, TableCaption } from '@/components/ui/primitives/table.js';

export default function DataTable({
  file,
  id,
  subscription,
  initialSearch = '',
  label: customLabel,
}) {
  const { t } = useI18n();
  const labelColumn = (header) => columnLabel(header, t);
  const state = useDataTable(file, subscription, initialSearch);
  const label = customLabel || t(REPORTS.find((report) => report.id === id)?.labelKey || id);
  const { result, items, filtered, clear } = state;
  const numericColumns = useMemo(
    () =>
      new Set(
        file.headers.filter(
          (header, index) =>
            !/(?:id|name|version|code)$/i.test(header) && isNumericColumn(file.rows, index),
        ),
      ),
    [file.headers, file.rows],
  );
  const isNumeric = (header, column) => (result.grouped ? column > 0 : numericColumns.has(header));
  if (file.rows.length === 0)
    return (
      <Card as="section" className="table-panel gap-0 py-0" aria-label={label}>
        <EmptyState
          className="inventory-empty rounded-none border-0 bg-transparent shadow-none"
          icon={Boxes}
          title={t('table.noResources')}
          description={t('table.noResourcesHint')}
        />
        <TablePagination state={state} label={label} />
      </Card>
    );
  return (
    <Card as="section" className="table-panel gap-0 py-0">
      <TableToolbar headers={file.headers} columnLabel={labelColumn} state={state} />
      <div className="table-scroll" tabIndex={0} aria-label={t('table.scrollLabel')}>
        <Table containerClassName="overflow-visible">
          <TableCaption className="sr-only">{label}</TableCaption>
          <TableHead file={file} state={state} isNumeric={isNumeric} columnLabel={labelColumn} />
          <TableBody rows={items} headers={result.headers} isNumeric={isNumeric} />
        </Table>
        {result.rows.length === 0 && <NoTableResults filtered={filtered} clear={clear} />}
      </div>
      <TablePagination state={state} label={label} />
    </Card>
  );
}
