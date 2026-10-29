import { useI18n } from '../../../i18n/useI18n.js';
import AppLink from '../../../app/routing/AppLink/index.jsx';
import { Button } from '../primitives/button.js';
import { Empty, EmptyHeader, EmptyTitle, EmptyContent } from '../primitives/empty.js';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main id="main" tabIndex={-1} className="home">
      <Empty className="empty-results">
        <EmptyHeader>
          <EmptyTitle as="h1">{t('notFound.title')}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <AppLink to="/">{t('notFound.backHome')}</AppLink>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
