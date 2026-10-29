import { cn } from '@/lib/utils.js';

export function ChartIndicator({ icon: Icon, color, indicator = 'dot', hidden = false }) {
  if (Icon) return <Icon aria-hidden="true" />;
  if (hidden) return null;
  return (
    <div
      aria-hidden="true"
      className={cn('shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)', {
        'h-2.5 w-2.5': indicator === 'dot',
        'w-1': indicator === 'line',
        'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
      })}
      style={{ '--color-bg': color, '--color-border': color }}
    />
  );
}
