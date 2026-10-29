'use client';

import { cn } from '@/lib/utils.js';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

export function DropdownMenuLabel({ className, inset, ...props }) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)}
      {...props}
    />
  );
}
