'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '@/lib/utils.js';

export function Command({ className, ...props }) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
        className,
      )}
      {...props}
    />
  );
}
