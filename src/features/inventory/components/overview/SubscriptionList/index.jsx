import { Card } from '../../../../../components/ui/primitives/card.js';
import { Label } from '../../../../../components/ui/primitives/label.js';
import { Input } from '../../../../../components/ui/primitives/input.js';
import { Button } from '../../../../../components/ui/primitives/button.js';
import './SubscriptionList.css';
import { useId, useMemo, useState } from 'react';
import { Check, ChevronRight, Layers, Search, X } from 'lucide-react';
import { useI18n } from '../../../../../i18n/useI18n.js';
import Pagination from '../../../../../components/ui/Pagination/index.jsx';
import { usePagination } from '../../../../../components/ui/usePagination.js';
import EmptyChart from '../EmptyChart/index.jsx';

export default function SubscriptionList({ entries, subscription, setSubscription }) {
  const { t, format } = useI18n();
  const [search, setSearch] = useState('');
  const searchId = useId();
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entries.filter(([name, , id]) => `${name} ${id}`.toLocaleLowerCase().includes(query));
  }, [entries, search]);
  const pagination = usePagination(filtered, 5, `${subscription}:${search}`);
  const searchable = entries.length > 5 || Boolean(search);
  return (
    <Card as="section" className="subscription-panel gap-0 py-0">
      <div className="panel-heading">
        <div>
          <h2>{t('overview.bySubscription')}</h2>
          <p>{t('overview.selectSubscription')}</p>
        </div>
        <Layers size={18} />
      </div>
      {searchable && (
        <div className="subscription-search focus-field">
          <Label htmlFor={searchId} className="sr-only">
            {t('subscriptions.search')}
          </Label>
          <Search size={17} aria-hidden="true" />
          <Input
            type="search"
            id={searchId}
            value={search}
            placeholder={t('subscriptions.search')}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <Button
              variant="ghost"
              size="default"
              className=""
              onClick={() => setSearch('')}
              aria-label={t('subscriptions.clearSearch')}
            >
              <X size={17} aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
      <div className="subscription-list">
        {pagination.items.map(([name, value, id]) => (
          <Button
            variant="ghost"
            size="default"
            key={id}
            className={subscription === id ? 'is-selected' : ''}
            aria-pressed={subscription === id}
            onClick={() => setSubscription(subscription === id ? '' : id)}
          >
            <span className="subscription-avatar">
              <Layers size={17} />
            </span>
            <span>
              {name}
              <small>{id}</small>
            </span>
            <strong>{format(value)}</strong>
            {subscription === id ? <Check size={16} /> : <ChevronRight size={16} />}
          </Button>
        ))}
        {!filtered.length && (
          <EmptyChart
            message={search ? 'table.noResults' : 'overview.noSubscriptions'}
            icon={Layers}
          />
        )}
      </div>
      <Pagination total={filtered.length} label={t('overview.bySubscription')} {...pagination} />
    </Card>
  );
}
