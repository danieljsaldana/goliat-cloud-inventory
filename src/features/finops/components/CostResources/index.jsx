import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/primitives/card.js';
import {
  Table,
  TableCaption,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/primitives/table.js';
import { Input } from '@/components/ui/primitives/input.js';
import Pagination from '@/components/ui/Pagination/index.jsx';
import { usePagination } from '@/components/ui/usePagination.js';
import AppLink from '@/app/routing/AppLink/index.jsx';
import { records } from '@/core/table/index.js';
import { useI18n } from '@/i18n/useI18n.js';

export default function CostResources({ entries, money, inventory, scope, setSubscription }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const current = useMemo(
    () => new Set(records(inventory.files.resources).map(({ id }) => id.toLowerCase())),
    [inventory.files.resources],
  );
  const search = query.trim().toLocaleLowerCase();
  const filtered = entries.filter((row) =>
    `${row.name} ${row.resourceId} ${row.serviceName} ${row.resourceGroup} ${row.subscriptionName}`
      .toLocaleLowerCase()
      .includes(search),
  );
  const pagination = usePagination(filtered, 10, scope + search);
  return (
    <Card as="section" className="finops-resources">
      <CardHeader className="finops-resource-heading">
        <div>
          <CardTitle as="h2">{t('finops.resources')}</CardTitle>
          <CardDescription>{t('finops.resourcesHelp')}</CardDescription>
        </div>
        <div className="finops-search">
          <Search size={16} aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('finops.search')}
            placeholder={t('finops.search')}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="table-scroll" tabIndex={0} aria-label={t('table.scrollLabel')}>
          <Table>
            <TableCaption className="sr-only">{t('finops.resources')}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('finops.resource')}</TableHead>
                <TableHead scope="col">{t('finops.service')}</TableHead>
                <TableHead scope="col">{t('subscriptions.label')}</TableHead>
                <TableHead scope="col">{t('finops.resourceGroup')}</TableHead>
                <TableHead scope="col" className="finops-amount">
                  {t('finops.spend')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.items.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="finops-resource-name">
                    {current.has(row.resourceId.toLowerCase()) ? (
                      <AppLink
                        to={`/inventario/resources/?q=${encodeURIComponent(row.resourceId)}`}
                        title={row.resourceId}
                        onClick={() => setSubscription(row.subscriptionId)}
                      >
                        {row.name}
                      </AppLink>
                    ) : (
                      <span title={row.resourceId}>{row.name || t('finops.noResource')}</span>
                    )}
                    {!inventory.loading &&
                      !inventory.errors.length &&
                      row.resourceId &&
                      !current.has(row.resourceId.toLowerCase()) && (
                        <small>{t('finops.outsideInventory')}</small>
                      )}
                  </TableCell>
                  <TableCell>{row.serviceName || t('finops.unassigned')}</TableCell>
                  <TableCell>{row.subscriptionName}</TableCell>
                  <TableCell>{row.resourceGroup || t('finops.unassigned')}</TableCell>
                  <TableCell className="finops-amount">{money(row.amount)}</TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={5}>{t('table.noResults')}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <Pagination
          total={filtered.length}
          label={t('finops.resources')}
          pageSizes={[10, 25, 50]}
          {...pagination}
        />
      </CardContent>
    </Card>
  );
}
