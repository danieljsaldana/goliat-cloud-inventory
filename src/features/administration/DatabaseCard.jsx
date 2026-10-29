import { Database } from 'lucide-react';
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

export default function DatabaseCard({ database, telemetry, hours, onPeriodChange, loading }) {
  const { t, format, localeTag } = useI18n();
  const tls = database?.tls;
  const connection =
    typeof tls === 'boolean' ? t(tls ? 'admin.tlsEnabled' : 'admin.tlsDisabled') : '—';
  return (
    <Card as="section" className="admin-card admin-database">
      <CardHeader>
        <div className="admin-card-heading">
          <CardTitle as="h2">
            <Database size={19} aria-hidden="true" /> {t('admin.databaseTitle')}
          </CardTitle>
          <Badge
            variant="outline"
            className={database ? 'admin-badge-success' : 'admin-badge-unavailable'}
          >
            {t(database ? 'admin.databaseConnected' : 'admin.serviceUnavailable')}
          </Badge>
        </div>
        <CardDescription>{t('admin.databaseHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="admin-service-content">
        {database ? (
          <>
            <div className="admin-resource-name">
              <span>{t('admin.databaseName')}</span>
              <strong>{database.name}</strong>
            </div>
            <div className="admin-service-size">
              <span>{t('admin.databaseSize')}</span>
              <strong>{formatBytes(database.bytes, localeTag)}</strong>
            </div>
            <ServiceMetrics
              service="database"
              telemetry={telemetry}
              hours={hours}
              onPeriodChange={onPeriodChange}
              loading={loading}
            />
            <details className="admin-service-details">
              <summary>{t('admin.databaseDetails')}</summary>
              <dl className="admin-specs">
                <div>
                  <dt>{t('admin.databaseVersion')}</dt>
                  <dd>{database.version || '—'}</dd>
                </div>
                <div>
                  <dt>{t('admin.connectionSecurity')}</dt>
                  <dd>{connection}</dd>
                </div>
                <div>
                  <dt>{t('admin.storedReports')}</dt>
                  <dd>{format(database.reports)}</dd>
                </div>
                <div>
                  <dt>{t('admin.storedRows')}</dt>
                  <dd>{format(database.rows)}</dd>
                </div>
              </dl>
              <div className="admin-host">
                <span>{t('admin.endpoint')}</span>
                <p>{database.host ? `${database.host}:${database.port}` : '—'}</p>
              </div>
              <p className="admin-help">{t('admin.databaseSizeHelp')}</p>
            </details>
          </>
        ) : (
          <>
            <p className="admin-service-unavailable" role="status">
              {t('admin.databaseUnavailable')}
            </p>
            <ServiceMetrics
              service="database"
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
