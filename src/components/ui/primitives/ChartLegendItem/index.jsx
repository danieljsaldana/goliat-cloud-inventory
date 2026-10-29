import { getPayloadConfig } from '../chart/utils/getPayloadConfig.js';
import { ChartIndicator } from '../ChartIndicator/index.jsx';

export function ChartLegendItem({ item, config, nameKey, hideIcon, valueFormatter }) {
  const series = getPayloadConfig(config, item, String(nameKey || item.dataKey || 'value'));
  return (
    <div role="listitem" className="flex min-w-0 items-center gap-2">
      <ChartIndicator icon={!hideIcon && series?.icon} color={item.color} />
      <span className="min-w-0 flex-1 text-muted-foreground">{series?.label || item.value}</span>
      {Boolean(valueFormatter) && (
        <span className="shrink-0 text-right tabular-nums">{valueFormatter(item)}</span>
      )}
    </div>
  );
}
