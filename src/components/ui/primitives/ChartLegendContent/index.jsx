import { cn } from '@/lib/utils.js';
import { useChart } from '../chart/useChart.js';
import { ChartLegendItem } from '../ChartLegendItem/index.jsx';

export function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = 'bottom',
  nameKey,
  config: providedConfig,
  valueFormatter,
}) {
  const { config } = useChart(providedConfig);
  if (!payload?.length) return null;
  return (
    <div
      role="list"
      className={cn(
        'flex flex-wrap items-center justify-center gap-4',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className,
      )}
    >
      {payload
        .filter((item) => item.type !== 'none')
        .map((item, index) => (
          <ChartLegendItem
            key={index}
            item={item}
            config={config}
            nameKey={nameKey}
            hideIcon={hideIcon}
            valueFormatter={valueFormatter}
          />
        ))}
    </div>
  );
}
