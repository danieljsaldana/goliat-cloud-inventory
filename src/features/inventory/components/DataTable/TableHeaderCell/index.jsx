import { Button } from '../../../../../components/ui/primitives/button.js';
import SortIcon from '../SortIcon/index.jsx';
import { ariaSort } from '../utils/ariaSort.js';
import { TableHead } from '@/components/ui/primitives/table.js';

export default function TableHeaderCell({ header, label, numeric, grouped, sort, onSort }) {
  return (
    <TableHead
      scope="col"
      className={numeric ? 'numeric-column' : undefined}
      aria-sort={ariaSort(header, grouped, sort)}
    >
      {grouped ? (
        label
      ) : (
        <Button
          variant="ghost"
          size="default"
          className="table-sort-button"
          onClick={() => onSort(header)}
        >
          <span>{label}</span>
          <SortIcon selected={sort?.key === header} direction={sort?.direction} />
        </Button>
      )}
    </TableHead>
  );
}
