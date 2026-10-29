'use client';

import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils.js';

export function BreadcrumbLink({ asChild, className, ...props }) {
  const Comp = asChild ? Slot.Root : 'a';

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn('transition-colors hover:text-foreground', className)}
      {...props}
    />
  );
}
