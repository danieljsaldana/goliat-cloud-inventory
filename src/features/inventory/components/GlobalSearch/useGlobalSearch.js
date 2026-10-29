import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSearchIndex, searchInventory } from '@/core/inventory/search.js';
import { routePath } from '@/core/routing/paths.js';
import { useI18n } from '@/i18n/useI18n.js';

export function useGlobalSearch(inventory, setSubscription) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState({ query: '', value: '' });
  const deferredQuery = useDeferredValue(query);
  const index = useMemo(
    () => (open ? createSearchIndex(inventory.files) : []),
    [open, inventory.files],
  );
  const results = useMemo(
    () => searchInventory(index, inventory.files, deferredQuery, t),
    [index, inventory.files, deferredQuery, t],
  );
  const values = results.groups.flatMap(({ items }) =>
    items.map((entry) => `${entry.kind}:${entry.key}`),
  );
  const selectedValue =
    selection.query === deferredQuery && values.includes(selection.value)
      ? selection.value
      : values[0] || '';

  function selectValue(value) {
    setSelection({ query: deferredQuery, value });
  }

  function changeOpen(value) {
    setOpen(value);
    if (!value) setQuery('');
  }

  useEffect(() => {
    const handleKey = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k' &&
        !event.altKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        setOpen((previous) => !previous);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function select(entry) {
    if (query !== deferredQuery) return;
    const route = ['inventario'];
    const params = new URLSearchParams();
    if (entry.kind === 'resources') {
      setSubscription(entry.subscriptionId);
      route.push(entry.reportId);
      params.set('q', entry.id);
    }
    if (entry.kind === 'subscriptions') setSubscription(entry.id);
    if (entry.kind === 'reports') route.push(entry.id);
    changeOpen(false);
    router.push('/' + routePath(route, locale) + (params.size ? '?' + params : ''));
  }

  return {
    open,
    changeOpen,
    query,
    setQuery,
    results,
    select,
    selectedValue,
    selectValue,
    pending: query !== deferredQuery,
  };
}
