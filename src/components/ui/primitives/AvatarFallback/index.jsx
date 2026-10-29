'use client';

import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils.js';

/** @param {import('../Avatar/types.js').AvatarFallbackProps} props */
export function AvatarFallback({ className, ...props }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-[inherit] bg-muted',
        className,
      )}
      {...props}
    />
  );
}
