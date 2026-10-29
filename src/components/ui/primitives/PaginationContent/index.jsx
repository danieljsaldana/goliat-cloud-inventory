import { cn } from '@/lib/utils.js';

/** @param {import('../Pagination/types.js').PaginationContentProps} props */
export function PaginationContent({ className, ...props }) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-wrap items-center justify-center gap-0.5', className)}
      {...props}
    />
  );
}
