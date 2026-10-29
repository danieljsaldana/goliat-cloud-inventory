'use client';

import { cn } from '@/lib/utils.js';
import { fieldVariants } from './constants.js';

export function Field({ className, orientation = 'vertical', ...props }) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}
