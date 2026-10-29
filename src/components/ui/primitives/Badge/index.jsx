import { cn } from '@/lib/utils.js';
import { Slot } from 'radix-ui';
import { badgeVariants } from './constants.js';

export function Badge({ className, variant = 'default', asChild = false, ...props }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
