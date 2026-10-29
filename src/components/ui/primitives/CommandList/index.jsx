'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '@/lib/utils.js';

export function CommandList({ className, ...props }) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn('max-h-[min(55vh,28rem)] overflow-x-hidden overflow-y-auto p-2', className)}
      {...props}
    />
  );
}
