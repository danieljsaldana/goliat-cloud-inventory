import { useId, useState } from 'react';
import { ChartNoAxesCombined } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Button } from '../../components/ui/primitives/button.js';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../../components/ui/primitives/chart.js';
import { useI18n } from '../../i18n/useI18n.js';
import { SERVICE_METRIC_VIEWS, METRIC_BYTE_UNITS } from './serviceMetricsConstants.js';
import MetricPeriodSelect from './MetricPeriodSelect.jsx';
import { serviceChartData } from './utils/serviceChartData.js';

export default function ServiceMetrics({
  service,
  telemetry,
  hours = 24,
  onPeriodChange,
  loading,
}) {
  const { t, localeTag } = useI18n();
  const views = SERVICE_METRIC_VIEWS[service];
  const [selected, setSelected] = useState(views[0].id);
  const id = useId();
  const view = views.find((entry) => entry.id === selected) || views[0];
  const metrics = view.metrics.map(
    (metricId) =>
      telemetry?.metrics?.find((metric) => metric.id === metricId) || {
        id: metricId,
        available: false,
        value: null,
        data: [],
        status: 'not-configured',
      },
  );
  const max = Math.max(
    0,
    ...metrics.flatMap((metric) => metric.data.map(({ value }) => value).filter(Number.isFinite)),
  );
  const otherUnit = { divisor: 1, label: view.unit === 'percent' ? '%' : '' };
  const byteUnit =
    METRIC_BYTE_UNITS.find(({ divisor }) => max >= divisor) || METRIC_BYTE_UNITS.at(-1);
  const scale = view.unit === 'bytes' ? byteUnit : otherUnit;
  const unit = view.unit === 'milliseconds' ? 'ms' : scale.label;
  const number = (value) =>
    new Intl.NumberFormat(localeTag, { maximumFractionDigits: 1 }).format(value);
  const config = Object.fromEntries(
    metrics.map((metric, index) => [
      metric.id,
      {
        label: `${t(`admin.serviceMetric.${metric.id}`)}${unit ? ` (${unit})` : ''}`,
        color: index === 0 ? 'var(--chart-1)' : 'var(--chart-2)',
      },
    ]),
  );
  const data = serviceChartData(metrics, scale.divisor);
  const available = metrics.some((metric) => metric.available);
  const status =
    metrics.find((metric) => metric.status === 'forbidden')?.status || metrics[0].status;
  const time = (value) =>
    new Intl.DateTimeFormat(localeTag, {
      ...(hours > 24 ? { day: '2-digit', month: 'short' } : {}),
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(value));
  const Chart = view.chart === 'bar' ? BarChart : LineChart;
  return (
    <div className="admin-service-metrics">
      <div className="admin-service-chart-heading">
        <h3>{t('admin.serviceActivity')}</h3>
        <MetricPeriodSelect hours={hours} onChange={onPeriodChange} disabled={loading} />
      </div>
      <div
        className="admin-service-chart-controls"
        role="group"
        aria-label={t('admin.metricSelector')}
      >
        {views.map((entry) => (
          <Button
            key={entry.id}
            id={`${id}-${entry.id}`}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={view.id === entry.id}
            aria-controls={`${id}-chart`}
            onClick={() => setSelected(entry.id)}
          >
            {t(`admin.metricView.${entry.id}`)}
          </Button>
        ))}
      </div>
      <div id={`${id}-chart`} role="region" aria-labelledby={`${id}-${view.id}`}>
        <dl className="admin-service-chart-summary">
          {metrics.map((metric) => (
            <div key={metric.id}>
              <dt>
                <span style={{ background: config[metric.id].color }} aria-hidden="true" />
                {t(`admin.serviceMetric.${metric.id}`)}
              </dt>
              <dd>
                {metric.available
                  ? `${number(metric.value / scale.divisor)}${unit ? ` ${unit}` : ''}`
                  : '—'}
              </dd>
              <span>
                {t(metric.aggregation === 'Total' ? 'admin.totalPeriod' : 'admin.averagePeriod', {
                  count: hours,
                })}
              </span>
            </div>
          ))}
        </dl>
        {available ? (
          <ChartContainer
            config={config}
            className="admin-service-chart"
            aria-label={t(`admin.metricView.${view.id}`)}
            initialDimension={{ width: 480, height: 180 }}
          >
            <Chart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="time"
                tickFormatter={time}
                minTickGap={45}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                width={42}
                tickFormatter={number}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                domain={view.unit === 'percent' ? [0, 100] : [0, 'auto']}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={time}
                    indicator={view.chart === 'bar' ? 'dot' : 'line'}
                  />
                }
              />
              {metrics.map((metric) =>
                view.chart === 'bar' ? (
                  <Bar
                    key={metric.id}
                    dataKey={metric.id}
                    fill={`var(--color-${metric.id})`}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={16}
                    isAnimationActive={false}
                  />
                ) : (
                  <Line
                    key={metric.id}
                    type="linear"
                    dataKey={metric.id}
                    stroke={`var(--color-${metric.id})`}
                    strokeWidth={2}
                    dot={metric.data.filter(({ value }) => Number.isFinite(value)).length === 1}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ),
              )}
            </Chart>
          </ChartContainer>
        ) : (
          <div className="admin-service-chart-empty" role="status">
            <ChartNoAxesCombined size={26} aria-hidden="true" />
            <p>{t(`admin.metricStatus.${status || 'unavailable'}`)}</p>
          </div>
        )}
      </div>
      <p className="admin-service-chart-note">{t(`admin.${service}MetricsHelp`)}</p>
    </div>
  );
}
