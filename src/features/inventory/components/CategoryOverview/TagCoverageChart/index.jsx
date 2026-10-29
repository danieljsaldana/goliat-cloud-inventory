import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegendContent,
} from '@/components/ui/primitives/chart.js';
import { useI18n } from '@/i18n/useI18n.js';
import Select from '@/components/ui/Select/index.jsx';
import Pagination from '@/components/ui/Pagination/index.jsx';
import { usePagination } from '@/components/ui/usePagination.js';
import ChartCard from '../../overview/ChartCard/index.jsx';
import BarAxisTick from '../../overview/Bars/BarAxisTick/index.jsx';
import { useBarChartLayout } from '../../overview/Bars/hooks/useBarChartLayout.js';
import { BAR_PAGE_SIZE, BAR_PAGE_SIZES } from '../../overview/Bars/constants.js';

export default function TagCoverageChart({ entries, scope, selected, onSelect }) {
  const { t, format } = useI18n();
  const pagination = usePagination(entries, BAR_PAGE_SIZE, scope);
  const { chartRef, axisWidth, labelHeight, rowHeight } = useBarChartLayout(
    Boolean(entries.length),
  );
  const config = {
    tagged: { label: t('category.tagged'), color: 'var(--chart-1)' },
    untagged: { label: t('category.untagged'), color: 'var(--chart-2)' },
    unknown: { label: t('category.unknownTags'), color: 'var(--chart-4)' },
  };
  const statuses = entries.some(({ unknown }) => unknown > 0)
    ? Object.keys(config)
    : ['tagged', 'untagged'];
  const title = t('category.coverageBySubscription');
  return (
    <ChartCard title={title} subtitle={t('category.anyTag')}>
      <ChartContainer
        ref={chartRef}
        config={config}
        className="resource-bar-chart"
        style={{ height: Math.max(220, pagination.items.length * rowHeight + 90) }}
        aria-label={title}
      >
        <BarChart
          accessibilityLayer
          data={pagination.items}
          layout="vertical"
          margin={{ left: 0, right: 12, top: 8, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickFormatter={format}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={axisWidth}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={<BarAxisTick axisWidth={axisWidth} labelHeight={labelHeight} />}
          />
          <ChartTooltip content={<ChartTooltipContent labelKey="name" />} />
          <Legend content={<ChartLegendContent />} />
          {statuses.map((status) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="coverage"
              fill={`var(--color-${status})`}
              barSize={20}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(item) =>
                onSelect('tagCoverage', JSON.stringify([item.payload.subscriptionId, status]))
              }
            />
          ))}
        </BarChart>
      </ChartContainer>
      <Select
        aria-label={t('category.exploreChart', { chart: title })}
        value={selected?.field === 'tagCoverage' ? selected.value : 'all'}
        onValueChange={(value) => onSelect('tagCoverage', value === 'all' ? null : value)}
        options={[
          { value: 'all', label: t('category.allResources') },
          ...entries.flatMap((entry) =>
            statuses.map((status) => ({
              value: JSON.stringify([entry.subscriptionId, status]),
              label: `${entry.name} · ${config[status].label} · ${format(entry[status])}`,
            })),
          ),
        ]}
      />
      <ul className="sr-only">
        {pagination.items.map((entry) => (
          <li key={entry.subscriptionId}>
            {entry.name}:{' '}
            {statuses
              .map((status) => `${config[status].label}: ${format(entry[status])}`)
              .join(', ')}
          </li>
        ))}
      </ul>
      <Pagination total={entries.length} label={title} pageSizes={BAR_PAGE_SIZES} {...pagination} />
    </ChartCard>
  );
}
