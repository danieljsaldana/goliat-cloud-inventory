import TableCell from '../TableCell/index.jsx';
import { TableBody as Body, TableRow } from '@/components/ui/primitives/table.js';

export default function TableBody({ rows, headers, isNumeric }) {
  return (
    <Body>
      {rows.map((row, index) => (
        <TableRow key={index}>
          {row.map((value, column) => (
            <TableCell
              key={column}
              value={value}
              header={headers[column]}
              numeric={isNumeric(headers[column], column)}
            />
          ))}
        </TableRow>
      ))}
    </Body>
  );
}
