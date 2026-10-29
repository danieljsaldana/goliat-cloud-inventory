import { cn } from '@/lib/utils.js';

export function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn('px-6', className)} {...props} />;
}
