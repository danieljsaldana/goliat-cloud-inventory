'use client';

import { cn } from '@/lib/utils.js';
import { Dialog as SheetPrimitive } from 'radix-ui';

export function SheetDescription({ className, ...props }) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
