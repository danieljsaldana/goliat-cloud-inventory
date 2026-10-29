import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/primitives/card.js';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/primitives/chart.js';
import { Label } from '@/components/ui/primitives/label.js';
import Select from '@/components/ui/Select/index.jsx';
import Pagination from '@/components/ui/Pagination/index.jsx';
import { usePagination } from '@/components/ui/usePagination.js';
import { useI18n } from '@/i18n/useI18n.js';

export default function CostDistribution({ entries, group, onGroup, money, scope }) {
  const { t } = useI18n();
  const pagination = usePagination(entries, 5, scope + group);
  const data = pagination.items.map((entry) => ({
    ...entry,
    name: entry.name || t(group === 'resourceId' ? 'finops.noResource' : 'finops.unassigned'),
    detail:
      entry.resourceId ||
      entry.name ||
      t(group === 'resourceId' ? 'finops.noResource' : 'finops.unassigned'),
  }));
  return (
    <Card as="section" className="finops-chart">
      <CardHeader>
        <CardTitle as="h2">{t('finops.distribution')}</CardTitle>
        <Label className="finops-filter">
          {t('finops.groupBy')}
          <Select
            value={group}
            onValueChange={onGroup}
            options={[
              { value: 'serviceName', label: t('finops.service') },
              { value: 'resourceId', label: t('finops.resource') },
              { value: 'resourceGroup', label: t('finops.resourceGroup') },
              { value: 'subscriptionId', label: t('subscriptions.label') },
            ]}
          />
        </Label>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="finops-bars"
          config={{ amount: { label: t('finops.spend'), color: 'var(--chart-1)' } }}
          aria-label={t('finops.distribution')}
        >
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 12, top: 4, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={money}
              tickLine={false}
              axisLine={false}
              tickCount={3}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={135}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(name) => (name.length > 18 ? name.slice(0, 17) + '…' : name)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelKey="detail"
                  labelClassName="break-all"
                  valueFormatter={money}
                />
              }
            />
            <Bar
              dataKey="amount"
              fill="var(--color-amount)"
              radius={4}
              barSize={18}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
        <ul className="sr-only">
          {data.map(({ key, detail, subscriptionName, amount }) => (
            <li key={key}>
              {detail} {group === 'resourceId' && subscriptionName}: {money(amount)}
            </li>
          ))}
        </ul>
        <Pagination
          total={entries.length}
          label={t('finops.distribution')}
          pageSizes={[5, 8, 10]}
          {...pagination}
        />
      </CardContent>
    </Card>
  );
}
