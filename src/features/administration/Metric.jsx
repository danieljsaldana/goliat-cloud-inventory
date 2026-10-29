import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Activity, Cpu, MemoryStick } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/primitives/card.js';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../../components/ui/primitives/chart.js';
import { useI18n } from '../../i18n/useI18n.js';

export default function Metric({ metric, hours = 24 }) {
  const { t, localeTag } = useI18n();
  const divisor = metric.unit === 'bytes' ? 1048576 : 1;
  const number = (value) =>
    new Intl.NumberFormat(localeTag, {
      maximumFractionDigits: metric.unit === 'count' ? 0 : 1,
    }).format(value);
  const otherSuffix = metric.unit === 'percent' ? ' %' : '';
  const suffix = metric.unit === 'bytes' ? ` ${t('admin.megabytes')}` : otherSuffix;
  const label = t(`admin.metric.${metric.id}`);
  const Icon = { executions: Activity, memory: MemoryStick, cpu: Cpu }[metric.id] || Activity;
  const config = {
    value: {
      label: suffix ? `${label} (${suffix.trim()})` : label,
      color: 'var(--chart-1)',
    },
  };
  const data = metric.data.map((point) => ({ ...point, value: point.value / divisor }));
  const time = (value) =>
    new Intl.DateTimeFormat(localeTag, {
      ...(hours > 24 ? { day: '2-digit', month: 'short' } : {}),
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(value));
  return (
    <Card as="article" className="admin-card admin-metric">
      <CardHeader>
        <div className="admin-card-heading">
          <CardTitle as="h3">{label}</CardTitle>
          <span className="admin-metric-icon">
            <Icon size={18} aria-hidden="true" />
          </span>
        </div>
        <strong className="admin-metric-value">
          {metric.available ? `${number(metric.value / divisor)}${suffix}` : '—'}
        </strong>
        <CardDescription>
          {t(metric.id === 'executions' ? 'admin.totalPeriod' : 'admin.averagePeriod', {
            count: hours,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {metric.available ? (
          <ChartContainer
            config={config}
            className="admin-chart"
            aria-label={label}
            initialDimension={{ width: 320, height: 160 }}
          >
            <LineChart
              accessibilityLayer
              data={data}
              margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="time"
                tickFormatter={time}
                minTickGap={55}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                width={42}
                tickFormatter={number}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={time} indicator="line" />}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="admin-unavailable">{t('admin.noMetrics')}</p>
        )}
      </CardContent>
    </Card>
  );
}
