import { ChevronLeft } from 'lucide-react';
import { PaginationLink } from '../PaginationLink/index.jsx';

/** @param {import('../Pagination/types.js').PaginationDirectionProps} props */
export function PaginationPrevious({ text, iconOnly = false, ...props }) {
  return (
    <PaginationLink size={iconOnly ? 'icon-sm' : 'sm'} {...props}>
      <ChevronLeft size={16} aria-hidden="true" />
      {!iconOnly && <span className="pagination-direction-label">{text}</span>}
    </PaginationLink>
  );
}
