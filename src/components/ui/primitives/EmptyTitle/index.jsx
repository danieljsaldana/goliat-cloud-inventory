'use client';

import { cn } from '@/lib/utils.js';

export function EmptyTitle({ as: Component = 'div', className, ...props }) {
  return (
    <Component
      data-slot="empty-title"
      className={cn('text-lg font-medium tracking-tight', className)}
      {...props}
    />
  );
}
