'use client';

import { cn } from '@/lib/utils.js';
import { emptyMediaVariants } from './constants.js';

export function EmptyMedia({ className, variant = 'default', ...props }) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}
