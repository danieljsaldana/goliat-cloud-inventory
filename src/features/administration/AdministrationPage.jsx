import { useCallback, useState } from 'react';
import { CalendarClock, CircleAlert, Info } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { useAsyncResource } from '../../hooks/useAsyncResource.js';
import { Alert, AlertDescription } from '../../components/ui/primitives/alert.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/primitives/card.js';
import { loadAdministration } from './api/functionAdministration.js';
import AdministrationHeading from './AdministrationHeading.jsx';
import AdministrationLoading from './AdministrationLoading.jsx';
import FunctionCard from './FunctionCard.jsx';
import InventoryCard from './InventoryCard.jsx';
import TagsCard from './TagsCard.jsx';
import DatabaseCard from './DatabaseCard.jsx';
import StorageCard from './StorageCard.jsx';
import ScheduleForm from './ScheduleForm.jsx';
import Metric from './Metric.jsx';
import MetricPeriodSelect from './MetricPeriodSelect.jsx';
import './AdministrationPage.css';

export default function AdministrationPage({ inventory }) {
  const { t, localeTag } = useI18n();
  const [hours, setHours] = useState(24);
  const load = useCallback((signal) => loadAdministration(signal, hours), [hours]);
  const { data, loading, error, reload } = useAsyncResource(load, {
    preserveData: true,
  });
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat(localeTag, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(value),
        )
      : '—';
  return (
    <main id="main" tabIndex={-1} className="admin-page">
      <AdministrationHeading
        loading={loading}
        checkedAt={data?.checkedAt}
        reload={reload}
        date={date}
      />
      {error && (
        <Alert variant="destructive" className="admin-error">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>
            {t(data ? 'admin.refreshFailed' : 'admin.loadFailed')}
          </AlertDescription>
        </Alert>
      )}
      {!data && loading && <AdministrationLoading />}
      {data && (
        <>
          <section className="admin-activity" aria-labelledby="admin-activity-title">
            <div className="admin-section-heading">
              <h2 id="admin-activity-title">{t('admin.activityTitle')}</h2>
              <MetricPeriodSelect hours={hours} onChange={setHours} disabled={loading} />
            </div>
            <div className="admin-metrics">
              {data.metrics.map((metric) => (
                <Metric key={metric.id} metric={metric} hours={data.windowHours} />
              ))}
            </div>
            <details className="admin-metrics-note">
              <summary>
                <Info size={15} aria-hidden="true" /> {t('admin.metricsSource')}
              </summary>
              <p>{t('admin.metricsHelp')}</p>
            </details>
          </section>
          <div className="admin-columns">
            <FunctionCard resource={data.function} />
            <Card as="section" className="admin-card admin-schedule-card">
              <CardHeader>
                <CardTitle as="h2">
                  <CalendarClock size={19} aria-hidden="true" /> {t('admin.scheduleTitle')}
                </CardTitle>
                <CardDescription>{t('admin.scheduleHelp')}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.schedule ? (
                  <ScheduleForm
                    key={data.schedule.version}
                    schedule={data.schedule}
                    reload={reload}
                    disabled={loading}
                  />
                ) : (
                  <p className="admin-help" role="status">
                    {t('admin.scheduleUnavailable')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <InventoryCard data={data} inventory={inventory} date={date} />
          <TagsCard tags={data.tags} inventory={inventory} reload={reload} disabled={loading} />
          <div className="admin-columns admin-data-services">
            <DatabaseCard
              database={data.database}
              telemetry={data.dataServices?.database}
              hours={data.windowHours}
              onPeriodChange={setHours}
              loading={loading}
            />
            <StorageCard
              publication={data.publication}
              date={date}
              telemetry={data.dataServices?.storage}
              hours={data.windowHours}
              onPeriodChange={setHours}
              loading={loading}
            />
          </div>
        </>
      )}
    </main>
  );
}
