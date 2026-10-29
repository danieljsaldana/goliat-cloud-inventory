import { cn } from '@/lib/utils.js';
import { buttonVariants } from '../Button/constants.js';

/** @param {import('../Pagination/types.js').PaginationLinkProps} props */
export function PaginationLink({
  as: Component = 'a',
  className,
  isActive = false,
  size = 'icon-sm',
  ...props
}) {
  return (
    <Component
      type={Component === 'button' ? 'button' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? 'outline' : 'ghost', size }),
        isActive && 'bg-card',
        className,
      )}
      {...props}
    />
  );
}
