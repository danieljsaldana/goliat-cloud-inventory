import { cn } from '@/lib/utils.js';

export function CardDescription({ className, ...props }) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
