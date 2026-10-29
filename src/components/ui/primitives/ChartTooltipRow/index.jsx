import { useI18n } from '@/i18n/useI18n.js';
import { useChart } from '../chart/useChart.js';
import { getPayloadConfig } from '../chart/utils/getPayloadConfig.js';
import { ChartIndicator } from '../ChartIndicator/index.jsx';

export function ChartTooltipRow({
  item,
  nameKey,
  indicator,
  hideIndicator,
  color,
  valueFormatter,
}) {
  const { config } = useChart();
  const { format } = useI18n();
  const series = getPayloadConfig(
    config,
    item,
    String(nameKey || item.name || item.dataKey || 'value'),
  );
  const text = series?.label || item.name;
  const defaultValue = typeof item.value === 'number' ? format(item.value) : String(item.value);
  const value = valueFormatter ? valueFormatter(item.value) : defaultValue;
  return (
    <div className="flex min-w-0 w-full flex-wrap items-center gap-2 [&>svg]:size-2.5 [&>svg]:text-muted-foreground">
      <ChartIndicator
        icon={series?.icon}
        color={color || item.payload?.fill || item.color}
        indicator={indicator}
        hidden={hideIndicator}
      />
      <span className="min-w-0 flex-[1_1_3rem] text-muted-foreground [overflow-wrap:anywhere]">
        {text}
      </span>
      {item.value !== null && item.value !== undefined && (
        <span className="ml-auto min-w-0 max-w-full shrink-0 text-right font-mono font-medium text-foreground tabular-nums [overflow-wrap:anywhere]">
          {value}
        </span>
      )}
    </div>
  );
}
