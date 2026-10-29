'use client';

import { cn } from '@/lib/utils.js';
import { ChevronUpIcon } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';

export function SelectScrollUpButton({ className, ...props }) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}
