'use client';

import { cn } from '@/lib/utils.js';

export function TableCaption({ className, ...props }) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
