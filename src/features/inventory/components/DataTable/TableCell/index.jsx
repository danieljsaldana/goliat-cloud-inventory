import { useI18n } from '../../../../../i18n/useI18n.js';
import { PILL_COLUMNS } from '../constants.js';
import { cellPillClass } from '../utils/cellPillClass.js';
import { TableCell as Cell } from '@/components/ui/primitives/table.js';
import { Badge } from '@/components/ui/primitives/badge.js';

export default function TableCell({ header, value, numeric }) {
  const { t } = useI18n();
  const className = [
    ['tags_json', 'id'].includes(header) ? 'mono' : '',
    numeric ? 'numeric-column' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const pill = PILL_COLUMNS.has(header) && Boolean(value);
  return (
    <Cell title={value} className={className}>
      <span className="table-cell-content">
        {pill && (
          <Badge variant="secondary" className={`cell-pill ${cellPillClass(header, value)}`}>
            {value}
          </Badge>
        )}
        {!pill && Boolean(value) && value}
        {!value && <span className="empty-cell">{t('common.emptyValue')}</span>}
      </span>
    </Cell>
  );
}
