'use client';

import { Dialog as SheetPrimitive } from 'radix-ui';

export function Sheet({ ...props }) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}
