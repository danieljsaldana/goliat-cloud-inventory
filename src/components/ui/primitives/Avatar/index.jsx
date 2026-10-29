'use client';

import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils.js';

/** @param {import('./types.js').AvatarProps} props */
export function Avatar({ className, ...props }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-[10px]', className)}
      {...props}
    />
  );
}
