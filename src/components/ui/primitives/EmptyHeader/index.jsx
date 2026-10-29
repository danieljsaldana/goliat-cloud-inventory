'use client';

import { cn } from '@/lib/utils.js';

export function EmptyHeader({ className, ...props }) {
  return (
    <div
      data-slot="empty-header"
      className={cn('flex max-w-sm flex-col items-center gap-2 text-center', className)}
      {...props}
    />
  );
}
