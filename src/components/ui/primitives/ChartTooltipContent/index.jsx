import { cn } from '@/lib/utils.js';
import { ChartTooltipLabel } from '../ChartTooltipLabel/index.jsx';
import { ChartTooltipRow } from '../ChartTooltipRow/index.jsx';

export function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = 'dot',
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  color,
  nameKey,
  labelKey,
  valueFormatter,
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      data-slot="chart-tooltip"
      className={cn(
        'grid min-w-[8rem] max-w-[min(20rem,calc(100vw-2rem))] grid-cols-[minmax(0,1fr)] items-start gap-1.5 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
      {!hideLabel && (
        <ChartTooltipLabel
          payload={payload}
          label={label}
          labelKey={labelKey}
          labelFormatter={labelFormatter}
          className={labelClassName}
        />
      )}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== 'none')
          .map((item, index) => (
            <ChartTooltipRow
              key={index}
              item={item}
              nameKey={nameKey}
              indicator={indicator}
              hideIndicator={hideIndicator}
              color={color}
              valueFormatter={valueFormatter}
            />
          ))}
      </div>
    </div>
  );
}
