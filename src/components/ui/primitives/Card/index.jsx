import { cn } from '@/lib/utils.js';

export function Card({ as: Component = 'div', className, ...props }) {
  return (
    <Component
      data-slot="card"
      className={cn(
        'flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
