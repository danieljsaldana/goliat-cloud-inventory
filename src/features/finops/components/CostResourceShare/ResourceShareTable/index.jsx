import {
  Table,
  TableCaption,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/primitives/table.js';
import Pagination from '@/components/ui/Pagination/index.jsx';
import { usePagination } from '@/components/ui/usePagination.js';
import { useI18n } from '@/i18n/useI18n.js';

export default function ResourceShareTable({ entries, money, percent, scope }) {
  const { t } = useI18n();
  const pagination = usePagination(entries, 5, scope);
  return (
    <div className="finops-share-detail">
      <Table>
        <TableCaption className="sr-only">{t('finops.resourceShare')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t('finops.resource')}</TableHead>
            <TableHead scope="col" className="finops-amount">
              {t('finops.spend')}
            </TableHead>
            <TableHead scope="col" className="finops-amount">
              {t('finops.share')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.items.map((entry) => (
            <TableRow key={entry.key}>
              <TableCell className="finops-share-resource" title={entry.resourceId || undefined}>
                <strong>{entry.name || t('finops.noResource')}</strong>
                <small>
                  {entry.subscriptionName} · {entry.resourceGroup || t('finops.unassigned')}
                </small>
                <small>{entry.services.join(', ')}</small>
                <span className="sr-only">{entry.resourceId}</span>
              </TableCell>
              <TableCell className="finops-amount">{money(entry.amount)}</TableCell>
              <TableCell className="finops-amount">{percent(entry.share)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        total={entries.length}
        label={t('finops.resourceShare')}
        pageSizes={[5, 10, 25]}
        {...pagination}
      />
    </div>
  );
}
