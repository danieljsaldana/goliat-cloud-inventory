'use client';

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

export function DropdownMenu({ ...props }) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}
