'use client';

import { NavigationMenu as NavigationMenuPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils.js';

export function NavigationMenuItem({ className, ...props }) {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn('relative', className)}
      {...props}
    />
  );
}
