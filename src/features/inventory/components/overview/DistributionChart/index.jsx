import { useI18n } from '../../../../../i18n/useI18n.js';
import Bars from '../Bars/index.jsx';
import EmptyChart from '../EmptyChart/index.jsx';
import './DistributionChart.css';

import { Pie, PieChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegendContent,
} from '@/components/ui/primitives/chart.js';
import { COLORS, DONUT_INITIAL_DIMENSION } from './constants.js';
import { chartSegments } from './utils/chartSegments.js';
import { legendPayload } from './utils/legendPayload.js';

export default function DistributionChart({ entries, label, scope }) {
  const { t, format, localeTag } = useI18n();
  const slices = entries.filter(([, value]) => value > 0);
  const total = slices.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return <EmptyChart />;
  if (slices.length > COLORS.length)
    return <Bars entries={slices} label={label} scope={scope} compact />;

  const percent = new Intl.NumberFormat(localeTag, {
    style: 'percent',
    maximumFractionDigits: 1,
  });
  const compact = new Intl.NumberFormat(localeTag, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const segments = chartSegments(slices, total, COLORS, t('common.unspecified'));
  const config = Object.fromEntries(
    segments.map((segment) => [segment.category, { label: segment.name, color: segment.fill }]),
  );
  const legend = legendPayload(segments);

  return (
    <figure className="distribution-chart" aria-label={label}>
      <figcaption className="text-sm text-muted-foreground">
        {t(slices.length === 1 ? 'common.elementCountOne' : 'common.elementCount', {
          count: format(slices.length),
        })}
        <span className="sr-only">
          {' '}
          · {t('overview.distributionTotal', { count: format(total) })}
        </span>
      </figcaption>
      <div className="donut-visual">
        <ChartContainer
          config={config}
          className="donut-chart"
          initialDimension={DONUT_INITIAL_DIMENSION}
        >
          <PieChart accessibilityLayer>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="category" />}
            />
            <Pie
              data={segments}
              dataKey="value"
              nameKey="category"
              innerRadius="65%"
              outerRadius="90%"
              startAngle={90}
              endAngle={-270}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </PieChart>
        </ChartContainer>
        <div className="donut-center" aria-hidden="true" title={format(total)}>
          <strong>{compact.format(total)}</strong>
          <span>{t('common.resources')}</span>
        </div>
      </div>
      <ChartLegendContent
        config={config}
        payload={legend}
        className="distribution-legend"
        nameKey="category"
        valueFormatter={(item) =>
          `${format(item.payload.value)} · ${percent.format(item.payload.share)}`
        }
      />
    </figure>
  );
}
