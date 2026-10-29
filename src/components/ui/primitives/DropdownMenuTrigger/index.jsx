'use client';

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

export function DropdownMenuTrigger({ ...props }) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}
