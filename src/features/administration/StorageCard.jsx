import { Cloud } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Badge } from '../../components/ui/primitives/badge.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/primitives/card.js';
import { formatBytes } from './utils/formatBytes.js';
import ServiceMetrics from './ServiceMetrics.jsx';

export default function StorageCard({
  publication,
  date,
  telemetry,
  hours,
  onPeriodChange,
  loading,
}) {
  const { t, localeTag } = useI18n();
  const storage = publication?.storage;
  const encrypted = storage?.encrypted;
  const encryption =
    typeof encrypted === 'boolean'
      ? t(encrypted ? 'admin.encryptionEnabled' : 'admin.encryptionDisabled')
      : '—';
  return (
    <Card as="section" className="admin-card admin-storage">
      <CardHeader>
        <div className="admin-card-heading">
          <CardTitle as="h2">
            <Cloud size={19} aria-hidden="true" /> {t('admin.storageTitle')}
          </CardTitle>
          <Badge
            variant="outline"
            className={storage ? 'admin-badge-success' : 'admin-badge-unavailable'}
          >
            {t(storage ? 'admin.blobAccessible' : 'admin.serviceUnavailable')}
          </Badge>
        </div>
        <CardDescription>{t('admin.storageHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="admin-service-content">
        {storage ? (
          <>
            <div className="admin-resource-name">
              <span>{t('admin.storageBlob')}</span>
              <strong>{storage.blob}</strong>
            </div>
            <div className="admin-service-size">
              <span>{t('admin.blobSize')}</span>
              <strong>{formatBytes(publication.bytes, localeTag)}</strong>
            </div>
            <ServiceMetrics
              service="storage"
              telemetry={telemetry}
              hours={hours}
              onPeriodChange={onPeriodChange}
              loading={loading}
            />
            <details className="admin-service-details">
              <summary>{t('admin.storageDetails')}</summary>
              <dl className="admin-specs">
                <div>
                  <dt>{t('admin.storageContainer')}</dt>
                  <dd>{storage.container}</dd>
                </div>
                <div>
                  <dt>{t('admin.storageTier')}</dt>
                  <dd>{storage.tier || '—'}</dd>
                </div>
                <div>
                  <dt>{t('admin.blobModified')}</dt>
                  <dd>{date(publication.lastModified)}</dd>
                </div>
                <div>
                  <dt>{t('admin.storageEncryption')}</dt>
                  <dd>{encryption}</dd>
                </div>
              </dl>
              <div className="admin-host">
                <span>{t('admin.storageEndpoint')}</span>
                <p>{storage.endpoint || '—'}</p>
              </div>
              <p className="admin-help">{t('admin.blobSizeHelp')}</p>
            </details>
          </>
        ) : (
          <>
            <p className="admin-service-unavailable" role="status">
              {t('admin.storageUnavailable')}
            </p>
            <ServiceMetrics
              service="storage"
              telemetry={telemetry}
              hours={hours}
              onPeriodChange={onPeriodChange}
              loading={loading}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
