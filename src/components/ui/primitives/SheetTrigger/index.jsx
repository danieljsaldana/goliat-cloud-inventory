'use client';

import { Dialog as SheetPrimitive } from 'radix-ui';

export function SheetTrigger(props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}
