import { ChevronRight } from 'lucide-react';
import { PaginationLink } from '../PaginationLink/index.jsx';

/** @param {import('../Pagination/types.js').PaginationDirectionProps} props */
export function PaginationNext({ text, iconOnly = false, ...props }) {
  return (
    <PaginationLink size={iconOnly ? 'icon-sm' : 'sm'} {...props}>
      {!iconOnly && <span className="pagination-direction-label">{text}</span>}
      <ChevronRight size={16} aria-hidden="true" />
    </PaginationLink>
  );
}
