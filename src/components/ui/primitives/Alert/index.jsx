import { cn } from '@/lib/utils.js';
import { alertVariants } from './constants.js';

export function Alert({ className, variant, ...props }) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
