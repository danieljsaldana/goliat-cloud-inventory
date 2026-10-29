'use client';

import { Collapsible as CollapsiblePrimitive } from 'radix-ui';

export function CollapsibleContent({ ...props }) {
  return <CollapsiblePrimitive.CollapsibleContent data-slot="collapsible-content" {...props} />;
}
