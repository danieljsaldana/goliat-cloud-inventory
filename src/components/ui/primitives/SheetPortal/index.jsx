'use client';

import { Dialog as SheetPrimitive } from 'radix-ui';

export function SheetPortal({ ...props }) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}
