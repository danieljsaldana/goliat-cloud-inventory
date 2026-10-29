import { cn } from '@/lib/utils.js';
import { useChart } from '../chart/useChart.js';

export function ChartTooltipLabel({ payload, label, labelKey, labelFormatter, className }) {
  const { config } = useChart();
  const value = labelKey ? payload[0]?.payload?.[labelKey] : label;
  const text = config[value]?.label || value;
  if (text === null || text === undefined) return null;
  return (
    <div className={cn('min-w-0 font-medium [overflow-wrap:anywhere]', className)}>
      {labelFormatter ? labelFormatter(text, payload) : text}
    </div>
  );
}
