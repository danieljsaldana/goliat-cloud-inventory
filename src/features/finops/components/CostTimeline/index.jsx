import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/primitives/card.js';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/primitives/chart.js';
import { useI18n } from '@/i18n/useI18n.js';

export default function CostTimeline({ entries, money }) {
  const { t, localeTag } = useI18n();
  const day = (value) =>
    new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(value),
    );
  return (
    <Card as="section" className="finops-chart">
      <CardHeader>
        <CardTitle as="h2">{t('finops.daily')}</CardTitle>
        <CardDescription>{t('finops.dailyHelp')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="finops-timeline"
          config={{ amount: { label: t('finops.spend'), color: 'var(--chart-1)' } }}
          aria-label={t('finops.daily')}
        >
          <LineChart
            accessibilityLayer
            data={entries}
            margin={{ left: 14, right: 12, top: 12, bottom: 4 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={day}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis tickFormatter={money} tickLine={false} axisLine={false} width={84} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={day} valueFormatter={money} />}
            />
            <Line
              dataKey="amount"
              type="linear"
              stroke="var(--color-amount)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
        <ul className="sr-only">
          {entries
            .filter(({ amount }) => amount !== null)
            .map(({ date, amount }) => (
              <li key={date}>
                {day(date)}: {money(amount)}
              </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}
