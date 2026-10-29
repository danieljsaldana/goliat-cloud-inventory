import { useI18n } from '../../../i18n/useI18n.js';
import { columnLabel } from '../../../core/table/index.js';
import {
  Table,
  TableCaption,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../primitives/table.js';

export default function ReadOnlyTable({ file, label }) {
  const { t } = useI18n();
  return (
    <div className="table-scroll" tabIndex={0} aria-label={t('table.scrollLabel')}>
      <Table containerClassName="overflow-visible">
        <TableCaption className="sr-only">{label}</TableCaption>
        <TableHeader>
          <TableRow>
            {file.headers.map((header) => (
              <TableHead key={header} scope="col">
                {columnLabel(header, t)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {file.rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((value, column) => (
                <TableCell key={column}>{value}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
