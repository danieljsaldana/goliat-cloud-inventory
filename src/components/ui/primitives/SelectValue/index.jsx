'use client';

import { Select as SelectPrimitive } from 'radix-ui';

export function SelectValue({ ...props }) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}
