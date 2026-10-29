import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils.js';

export function Spinner({ className, ...props }) {
  return (
    <LoaderCircle
      data-slot="spinner"
      aria-hidden="true"
      className={cn('size-4 animate-spin motion-reduce:animate-none', className)}
      {...props}
    />
  );
}
