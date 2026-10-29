'use client';

import { Collapsible as CollapsiblePrimitive } from 'radix-ui';

export function Collapsible({ ...props }) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}
