import { ChartTooltipContent } from '@/components/ui/primitives/chart.js';

export default function ResourceShareTooltip({ money, percent, ...props }) {
  const entry = props.payload?.[0]?.payload;
  if (!entry) return null;
  return (
    <ChartTooltipContent
      {...props}
      labelKey="name"
      nameKey="amount"
      valueFormatter={(amount) => `${money(amount)} · ${percent(entry.share)}`}
    />
  );
}
