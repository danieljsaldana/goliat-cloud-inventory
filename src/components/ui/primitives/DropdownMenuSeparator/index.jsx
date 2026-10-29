'use client';

import { cn } from '@/lib/utils.js';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

export function DropdownMenuSeparator({ className, ...props }) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}
