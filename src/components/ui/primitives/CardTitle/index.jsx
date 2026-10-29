import { cn } from '@/lib/utils.js';

export function CardTitle({ as: Component = 'div', className, ...props }) {
  return (
    <Component
      data-slot="card-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  );
}
