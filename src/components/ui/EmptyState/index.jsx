import { Card } from '../primitives/card.js';
import { cn } from '@/lib/utils.js';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from '../primitives/empty.js';
/** @param {import('./types.js').EmptyStateProps} props */
export default function EmptyState({ icon: Icon, title, description, children, className }) {
  return (
    <Card as="section" className={cn('empty-state gap-0 py-0', className)} role="status">
      <Empty className="empty-results">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="empty-state-icon">
            <Icon size={30} aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle as="h2">{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {Boolean(children) && <EmptyContent>{children}</EmptyContent>}
      </Empty>
    </Card>
  );
}
