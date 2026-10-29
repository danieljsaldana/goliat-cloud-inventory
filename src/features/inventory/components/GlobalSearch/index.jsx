import { Search } from 'lucide-react';
import { Button } from '@/components/ui/primitives/button.js';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
} from '@/components/ui/primitives/command.js';
import { useI18n } from '@/i18n/useI18n.js';
import { useGlobalSearch } from './useGlobalSearch.js';
import SearchResultItem from './SearchResultItem/index.jsx';
import './GlobalSearch.css';

export default function GlobalSearch({ inventory, setSubscription }) {
  const { t } = useI18n();
  const state = useGlobalSearch(inventory, setSubscription);
  const hasFiles = Object.keys(inventory.files).length > 0;
  const status = (() => {
    if (!hasFiles && inventory.loading) return 'globalSearch.loading';
    if (!hasFiles && inventory.errors.length) return 'globalSearch.unavailable';
    if (!hasFiles) return 'globalSearch.noInventory';
    if (inventory.errors.length) return 'globalSearch.partial';
    return 'globalSearch.scope';
  })();
  return (
    <CommandDialog
      open={state.open}
      onOpenChange={state.changeOpen}
      title={t('globalSearch.title')}
      description={t('globalSearch.description')}
      closeLabel={t('common.close')}
      commandProps={{
        value: state.selectedValue,
        onValueChange: state.selectValue,
        loop: true,
        vimBindings: false,
      }}
      trigger={
        <Button
          variant="outline"
          className="global-search-trigger"
          aria-label={t('globalSearch.open')}
          aria-keyshortcuts="Control+k Meta+k"
        >
          <Search size={17} aria-hidden="true" />
          <span className="global-search-trigger-label">{t('globalSearch.button')}</span>
          <kbd className="global-search-shortcut">{t('globalSearch.shortcut')}</kbd>
        </Button>
      }
    >
      <CommandInput
        value={state.query}
        onValueChange={state.setQuery}
        placeholder={t('globalSearch.placeholder')}
        aria-label={t('globalSearch.title')}
      />
      <p className="global-search-status" role="status">
        {t(status)}
      </p>
      <CommandList aria-busy={state.pending}>
        {hasFiles && <CommandEmpty>{t('globalSearch.noResults')}</CommandEmpty>}
        {state.results.groups
          .filter(({ items }) => items.length)
          .map(({ kind, items }) => (
            <CommandGroup key={kind} heading={t(`globalSearch.${kind}`)}>
              {items.map((entry) => (
                <SearchResultItem key={entry.key} entry={entry} select={state.select} />
              ))}
            </CommandGroup>
          ))}
      </CommandList>
      <div className="global-search-footer">
        <span>{t('globalSearch.keyboard')}</span>
        {state.query.trim() && (
          <span role="status">
            {t(
              state.results.total > state.results.shown
                ? 'globalSearch.moreResults'
                : 'globalSearch.resultCount',
              {
                shown: state.results.shown,
                total: state.results.total,
              },
            )}
          </span>
        )}
      </div>
    </CommandDialog>
  );
}
