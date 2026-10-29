'use client';

import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils.js';

export function Tabs({ className, ...props }) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}
