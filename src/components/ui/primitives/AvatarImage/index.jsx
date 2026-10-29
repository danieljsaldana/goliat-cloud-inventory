'use client';

import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils.js';

/** @param {import('../Avatar/types.js').AvatarImageProps} props */
export function AvatarImage({ className, ...props }) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
}
