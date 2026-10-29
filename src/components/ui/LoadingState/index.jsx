import { useI18n } from '../../../i18n/useI18n.js';
import { Card } from '../primitives/card.js';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '../primitives/empty.js';
import { Spinner } from '../primitives/spinner.js';
import { cn } from '@/lib/utils.js';

/** @param {import('./types.js').LoadingStateProps} props */
export default function LoadingState({
  message = 'loading.view',
  description = 'loading.description',
  className,
}) {
  const { t } = useI18n();
  return (
    <Card
      as="section"
      className={cn('loading-state gap-0 py-0', className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Empty className="min-h-64 gap-4 py-10 sm:min-h-72 md:p-10">
        <EmptyHeader className="gap-3">
          <EmptyMedia
            variant="icon"
            className="size-14 rounded-xl border border-primary/15 bg-primary/5 text-primary [&_svg]:size-6"
          >
            <Spinner />
          </EmptyMedia>
          <EmptyTitle as="h2" className="text-base sm:text-lg">
            {t(message)}
          </EmptyTitle>
          <EmptyDescription>{t(description)}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Card>
  );
}
