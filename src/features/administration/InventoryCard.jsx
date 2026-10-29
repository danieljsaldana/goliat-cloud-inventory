import { Activity, Cloud, Database } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Badge } from '../../components/ui/primitives/badge.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/primitives/card.js';
import InventorySyncStatus from './InventorySyncStatus.jsx';

export default function InventoryCard({ data, inventory, date }) {
  const { t, format: formatNumber } = useI18n();
  const operation = data.operation;
  const operationLabel = operation
    ? t(`admin.operation.${operation.status}`)
    : t('admin.noOperation');
  const publication = data.publication;
  const errors = inventory.errors.length;
  return (
    <Card as="section" className="admin-card admin-inventory">
      <CardHeader>
        <CardTitle as="h2">
          <Activity size={19} aria-hidden="true" /> {t('admin.inventoryTitle')}
        </CardTitle>
        <CardDescription>{t('admin.inventoryHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="admin-inventory-content">
        <InventorySyncStatus
          importedAt={inventory.metadata?.generatedAt}
          publishedAt={publication?.generatedAt}
          importedEtag={inventory.metadata?.storage?.etag}
          publishedEtag={publication?.etag}
        />
        <div className="admin-inventory-summary">
          <dl className="admin-timestamps">
            <div>
              <dt>
                <Database size={16} aria-hidden="true" /> {t('admin.generatedAt')}
              </dt>
              <dd>{date(inventory.metadata?.generatedAt)}</dd>
            </div>
            <div>
              <dt>
                <Cloud size={16} aria-hidden="true" /> {t('admin.publishedAt')}
              </dt>
              <dd>
                {publication
                  ? date(publication.generatedAt || publication.lastModified)
                  : t('admin.publicationUnavailable')}
              </dd>
            </div>
          </dl>
          <dl className="admin-inventory-counts">
            <div>
              <dt>{t('admin.resources')}</dt>
              <dd>
                {typeof publication?.resources === 'number'
                  ? formatNumber(publication.resources)
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('admin.views')}</dt>
              <dd>{formatNumber(Object.keys(inventory.files).length)}</dd>
            </div>
            <div>
              <dt>{t('admin.errors')}</dt>
              <dd className={errors ? 'admin-error-value' : 'admin-success-value'}>
                {formatNumber(errors)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="admin-operation">
          <div>
            <span>{t('admin.operation')}</span>
            <Badge
              variant="outline"
              className={operation?.status === 'succeeded' ? 'admin-badge-success' : ''}
            >
              {data.operationAvailable ? operationLabel : t('admin.operationUnavailable')}
            </Badge>
          </div>
          {operation && (
            <p className="admin-operation-id">
              {t('admin.operationId')}: <code>{operation.operationId}</code>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
