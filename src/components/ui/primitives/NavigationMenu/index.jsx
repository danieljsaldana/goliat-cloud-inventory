'use client';

import { NavigationMenu as NavigationMenuPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils.js';

export function NavigationMenu({ className, children, ...props }) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      data-viewport={false}
      className={cn(
        'group/navigation-menu relative flex max-w-max flex-1 items-center justify-center',
        className,
      )}
      {...props}
    >
      {children}
    </NavigationMenuPrimitive.Root>
  );
}
