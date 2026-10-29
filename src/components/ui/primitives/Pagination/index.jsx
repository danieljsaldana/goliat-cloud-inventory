import { cn } from '@/lib/utils.js';

/** @param {import('./types.js').PaginationProps} props */
export function Pagination({ className, ...props }) {
  return (
    <nav
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}
