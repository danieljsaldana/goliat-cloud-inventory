import { Pie, PieChart } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/primitives/chart.js';
import { useI18n } from '@/i18n/useI18n.js';
import ResourceShareTooltip from '../ResourceShareTooltip/index.jsx';
import { COLORS } from './constants.js';

export default function ResourceShareChart({ slices, money, percent }) {
  const { t, format } = useI18n();
  const data = slices.map((entry, index) => ({
    ...entry,
    name: entry.other
      ? t('finops.otherResources', { count: format(entry.count) })
      : entry.name || t('finops.noResource'),
    fill: COLORS[index],
  }));
  return (
    <figure className="finops-share-figure" aria-label={t('finops.resourceShare')}>
      <ChartContainer
        className="finops-pie"
        config={{ amount: { label: t('finops.spend'), color: 'var(--chart-1)' } }}
      >
        <PieChart accessibilityLayer>
          <ChartTooltip
            cursor={false}
            wrapperStyle={{ maxWidth: '100%' }}
            content={<ResourceShareTooltip money={money} percent={percent} />}
          />
          <Pie
            data={data}
            dataKey="amount"
            nameKey="name"
            outerRadius="90%"
            startAngle={90}
            endAngle={-270}
            stroke="var(--background)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </PieChart>
      </ChartContainer>
      <ul className="finops-share-legend">
        {data.map(({ key, name, fill, share }) => (
          <li key={key} title={name}>
            <span className="finops-share-swatch" style={{ background: fill }} aria-hidden="true" />
            <span>{name}</span>
            <strong>{percent(share)}</strong>
          </li>
        ))}
      </ul>
    </figure>
  );
}
