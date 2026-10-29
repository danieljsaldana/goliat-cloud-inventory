'use client';

import { NavigationMenu as NavigationMenuPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils.js';

export function NavigationMenuList({ className, ...props }) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)}
      {...props}
    />
  );
}
