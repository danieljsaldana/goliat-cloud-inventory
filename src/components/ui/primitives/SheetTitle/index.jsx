'use client';

import { cn } from '@/lib/utils.js';
import { Dialog as SheetPrimitive } from 'radix-ui';

export function SheetTitle({ className, ...props }) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  );
}
