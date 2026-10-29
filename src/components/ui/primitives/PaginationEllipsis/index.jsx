import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils.js';

/** @param {import('../Pagination/types.js').PaginationEllipsisProps} props */
export function PaginationEllipsis({ label, className, ...props }) {
  return (
    <span
      data-slot="pagination-ellipsis"
      aria-hidden="true"
      className={cn('flex size-8 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal size={16} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
