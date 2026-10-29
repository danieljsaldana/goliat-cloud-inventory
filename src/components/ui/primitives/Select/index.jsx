'use client';

import { Select as SelectPrimitive } from 'radix-ui';

export function Select({ ...props }) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}
