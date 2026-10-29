'use client';

import { Command as CommandPrimitive } from 'cmdk';

export function CommandEmpty(props) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="px-4 py-8 text-center text-sm text-muted-foreground"
      {...props}
    />
  );
}
