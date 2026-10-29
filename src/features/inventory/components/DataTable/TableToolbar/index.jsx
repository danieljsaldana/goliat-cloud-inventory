import { Label } from '../../../../../components/ui/primitives/label.js';
import { useId } from 'react';
import { Layers3, Search, SlidersHorizontal, X } from 'lucide-react';
import Select from '../../../../../components/ui/Select/index.jsx';
import { Button } from '../../../../../components/ui/primitives/button.js';
import { Input } from '../../../../../components/ui/primitives/input.js';
import { useI18n } from '../../../../../i18n/useI18n.js';

export default function TableToolbar({ headers, columnLabel, state }) {
  const { t, format } = useI18n();
  const groupedHintId = useId();
  const {
    search,
    setSearch,
    groupBy,
    setGroupBy,
    showFilters,
    filters = {},
    setShowFilters,
    setPage,
    filtered,
    clear,
    result,
  } = state;
  const filterCount = Object.values(filters).filter(Boolean).length;
  const filtersVisible = showFilters && !groupBy;
  const groupedHint = groupBy ? t('table.groupedFiltersHint') : undefined;
  return (
    <div className="table-toolbar">
      <div className="table-toolbar-fields">
        <Label className="search-field focus-field">
          <Search size={17} aria-hidden="true" />
          <Input
            type="search"
            aria-label={t('table.searchLabel')}
            placeholder={t('table.searchPlaceholder')}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </Label>
        <div className="table-group-field" data-active={Boolean(groupBy)}>
          <Layers3 size={17} aria-hidden="true" />
          <Select
            className="group-select"
            aria-label={t('table.groupLabel')}
            aria-describedby={groupBy ? groupedHintId : undefined}
            title={groupedHint}
            value={groupBy}
            size="sm"
            onValueChange={(value) => {
              setGroupBy(value);
              setPage(0);
            }}
            options={[
              { value: '', label: t('table.groupPlaceholder') },
              ...headers.map((header) => ({ value: header, label: columnLabel(header) })),
            ]}
          />
        </div>
        {Boolean(groupBy) && (
          <span id={groupedHintId} className="sr-only">
            {groupedHint}
          </span>
        )}
      </div>
      <div className="table-toolbar-actions">
        <span className="table-result-count" role="status" aria-atomic="true">
          {t(result.grouped ? 'table.groupCount' : 'table.resultCount', {
            count: format(result.rows.length),
          })}
        </span>
        {filtered && (
          <Button variant="outline" size="sm" onClick={clear}>
            <X size={16} aria-hidden="true" />
            {t('table.clearFilters')}
          </Button>
        )}
        <Button
          variant={filtersVisible || filterCount ? 'secondary' : 'outline'}
          size="sm"
          className={filtersVisible || filterCount ? 'is-active' : ''}
          aria-pressed={Boolean(filtersVisible)}
          aria-label={
            filterCount ? t('table.activeFilters', { count: format(filterCount) }) : undefined
          }
          aria-describedby={groupBy ? groupedHintId : undefined}
          title={groupedHint}
          disabled={Boolean(groupBy)}
          onClick={() => setShowFilters((value) => !value)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          {t('table.filters')}
          {filterCount > 0 && (
            <span className="table-filter-count" aria-hidden="true">
              {format(filterCount)}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
