import './Bars.css';
import { useI18n } from '../../../../../i18n/useI18n.js';
import Pagination from '../../../../../components/ui/Pagination/index.jsx';
import { usePagination } from '../../../../../components/ui/usePagination.js';
import EmptyChart from '../EmptyChart/index.jsx';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/primitives/chart.js';
import {
  BAR_AXIS_TICK_MARGIN,
  BAR_CHART_FOOTER_HEIGHT,
  BAR_PAGE_SIZE,
  BAR_PAGE_SIZES,
} from './constants.js';
import { chartRows } from './utils/chartRows.js';
import BarAxisTick from './BarAxisTick/index.jsx';
import { useBarChartLayout } from './hooks/useBarChartLayout.js';

export default function Bars({ entries, compact = false, formatLabel, label, scope, onSelect }) {
  const { t, format } = useI18n();
  const pagination = usePagination(entries, BAR_PAGE_SIZE, scope);
  const { chartRef, axisWidth, labelHeight, rowHeight } = useBarChartLayout(
    Boolean(entries.length),
  );
  const max = entries.reduce((maximum, [, value]) => Math.max(maximum, value), 1);
  const data = chartRows(pagination.items, formatLabel, t('common.unspecified'));
  const config = { resources: { label: t('common.resources'), color: 'var(--chart-1)' } };
  if (!entries.length) return <EmptyChart />;
  return (
    <>
      <ChartContainer
        ref={chartRef}
        config={config}
        className="resource-bar-chart"
        style={{ height: Math.max(180, data.length * rowHeight + BAR_CHART_FOOTER_HEIGHT) }}
        aria-label={label}
      >
        <BarChart
          accessibilityLayer
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 42, top: 8, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            dataKey="resources"
            domain={[0, Math.ceil(max * 1.15)]}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickFormatter={format}
            tickCount={3}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={<BarAxisTick axisWidth={axisWidth} labelHeight={labelHeight} />}
            tickMargin={BAR_AXIS_TICK_MARGIN}
            width={axisWidth}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="name" />} />
          <Bar
            onClick={onSelect ? (data) => onSelect(data.payload?.id ?? data.id) : undefined}
            cursor={onSelect ? 'pointer' : undefined}
            dataKey="resources"
            fill="var(--color-resources)"
            radius={4}
            barSize={compact ? 16 : 22}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="resources"
              position="right"
              formatter={format}
              fill="var(--foreground)"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <ul className="sr-only">
        {data.map((item) => (
          <li key={item.id}>
            {item.name}: {format(item.resources)}
          </li>
        ))}
      </ul>
      <Pagination total={entries.length} label={label} pageSizes={BAR_PAGE_SIZES} {...pagination} />
    </>
  );
}
