import { Button } from '../../../../../components/ui/primitives/button.js';
import { Search } from 'lucide-react';
import { useI18n } from '../../../../../i18n/useI18n.js';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/primitives/empty.js';

export default function NoTableResults({ filtered, clear }) {
  const { t } = useI18n();
  return (
    <Empty className="empty-results">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search size={28} aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle as="h3">{t('table.noResults')}</EmptyTitle>
        <EmptyDescription>{t('table.noResultsHint')}</EmptyDescription>
      </EmptyHeader>
      {filtered && (
        <EmptyContent>
          <Button variant="outline" size="default" onClick={clear}>
            {t('table.clearFilters')}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
