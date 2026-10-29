import { Input } from '../../../../../components/ui/primitives/input.js';
import { useI18n } from '../../../../../i18n/useI18n.js';
import TableHeaderCell from '../TableHeaderCell/index.jsx';
import { TableHeader, TableRow, TableHead as HeadCell } from '@/components/ui/primitives/table.js';

export default function TableHead({ file, state, isNumeric, columnLabel }) {
  const { t } = useI18n();
  const { result, sort, sortColumn, showFilters, filters, setFilters, setPage } = state;
  return (
    <TableHeader>
      <TableRow>
        {result.headers.map((header, column) => (
          <TableHeaderCell
            key={header}
            header={header}
            label={columnLabel(header)}
            numeric={isNumeric(header, column)}
            grouped={result.grouped}
            sort={sort}
            onSort={sortColumn}
          />
        ))}
      </TableRow>
      {showFilters && !result.grouped && (
        <TableRow className="column-filters">
          {file.headers.map((header, index) => (
            <HeadCell key={header} className={filters[index] ? 'has-filter' : undefined}>
              <Input
                aria-label={t('table.filterColumn', { column: columnLabel(header) })}
                placeholder={t('table.filterPlaceholder')}
                value={filters[index] || ''}
                onChange={(event) => {
                  setFilters((previous) => ({ ...previous, [index]: event.target.value }));
                  setPage(0);
                }}
              />
            </HeadCell>
          ))}
        </TableRow>
      )}
    </TableHeader>
  );
}
