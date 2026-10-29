import { useMemo, useState } from 'react';
import { Boxes, Layers, MapPin, Shapes, Tags } from 'lucide-react';
import {
  getCategoryOverview,
  countResources,
  resourceTags,
  tagValue,
} from '@/core/inventory/categories.js';
import { useI18n } from '@/i18n/useI18n.js';
import { Button } from '@/components/ui/primitives/button.js';
import { Label } from '@/components/ui/primitives/label.js';
import Select from '@/components/ui/Select/index.jsx';
import EmptyState from '@/components/ui/EmptyState/index.jsx';
import DataTable from '../DataTable/index.jsx';
import Kpi from '../overview/Kpi/index.jsx';
import CategoryChart from './CategoryChart/index.jsx';
import TagCoverageChart from './TagCoverageChart/index.jsx';
import SubscriptionList from '../overview/SubscriptionList/index.jsx';
import { resourceTypeLabel } from '../overview/Bars/utils/resourceTypeLabel.js';
import CategoryReports from './CategoryReports/index.jsx';
import '../overview/Overview/Overview.css';
import './CategoryOverview.css';

export default function CategoryOverview({ group, files, subscription, setSubscription }) {
  const { t, format } = useI18n();
  const data = useMemo(() => getCategoryOverview(files, group), [files, group]);
  const [selected, setSelected] = useState(null);
  const [chosenKey, setChosenKey] = useState('');
  const defaultKey = data.tagKeys.includes('environment') ? 'environment' : data.tagKeys[0] || '';
  const tagKey = data.tagKeys.includes(chosenKey) ? chosenKey : defaultKey;
  const isTags = group === 'tags';
  const scope = `${group}:${subscription}`;
  const tagEntries = useMemo(() => {
    const entries = countResources(
      data.rows
        .filter((row) => resourceTags(row) !== null)
        .map((row) => ({ value: JSON.stringify([tagValue(row, tagKey)]) })),
      'value',
    );
    return entries;
  }, [data.rows, tagKey]);
  const formatTag = (value) => {
    const raw = JSON.parse(value)[0];
    if (raw === null) return t('category.missingTag');
    return raw === '' ? t('category.emptyTagValue') : raw;
  };
  const filtered = data.rows.filter((row) => {
    if (!selected) return true;
    if (selected.field === 'tagCoverage') {
      const [subscriptionId, status] = JSON.parse(selected.value);
      const tags = resourceTags(row);
      if (row.subscriptionId !== subscriptionId) return false;
      if (status === 'unknown') return tags === null;
      return tags !== null && Boolean(Object.keys(tags).length) === (status === 'tagged');
    }
    if (selected.field === 'tagValue')
      return resourceTags(row) !== null && tagValue(row, tagKey) === JSON.parse(selected.value)[0];
    return (row[selected.field] ?? '') === selected.value;
  });
  const file = {
    headers: data.tableHeaders,
    rows: filtered.map((row) => data.tableHeaders.map((key) => String(row[key] ?? ''))),
  };
  const selectField = (field, value) => setSelected(value === null ? null : { field, value });
  const chartProps = { scope, selected, onSelect: selectField };
  const resourceGroupLabels = new Map(
    data.rows.map((row) => [
      row.resourceGroupKey,
      data.subscriptionEntries.length > 1
        ? `${row.resourceGroup} · ${row.subscriptionName || row.subscriptionId}`
        : row.resourceGroup,
    ]),
  );
  const formatSelection = () => {
    if (!selected) return '';
    if (selected.field === 'tagValue') return formatTag(selected.value);
    if (selected.field === 'resourceGroupKey') return resourceGroupLabels.get(selected.value);
    if (selected.field === 'tagCoverage') {
      const [id, status] = JSON.parse(selected.value);
      const labelKey = status === 'unknown' ? 'category.unknownTags' : `category.${status}`;
      return `${data.tagCoverage.find((row) => row.subscriptionId === id)?.name || id} · ${t(labelKey)}`;
    }
    return selected.value || t('common.unspecified');
  };
  return (
    <div className="category-overview">
      {data.partial && (
        <p className="category-notice" role="status">
          {t('category.partial')}
        </p>
      )}
      <div className="kpi-grid">
        <Kpi
          label={t('overview.totalResources')}
          value={data.hasData ? format(data.rows.length) : '—'}
          note={t('category.uniqueResources')}
          icon={Boxes}
          accent
        />
        <Kpi
          label={t(isTags ? 'category.tagged' : 'overview.resourceTypes')}
          value={data.hasData ? format(isTags ? data.tagged : data.types.length) : '—'}
          note={t(isTags ? 'category.anyTag' : 'category.inCategory')}
          icon={isTags ? Tags : Shapes}
        />
        <Kpi
          label={t(isTags ? 'category.untagged' : 'overview.activeSubscriptions')}
          value={
            data.hasData ? format(isTags ? data.untagged : data.subscriptionEntries.length) : '—'
          }
          note={t('overview.selectedInventory')}
          icon={isTags ? Tags : Layers}
        />
        <Kpi
          label={t(isTags ? 'category.tagKeys' : 'category.regions')}
          value={
            data.hasData
              ? format(
                  isTags ? data.tagKeys.length : data.locations.filter(([name]) => name).length,
                )
              : '—'
          }
          note={t(isTags ? 'category.observedKeys' : 'overview.locationDescription')}
          icon={isTags ? Tags : MapPin}
        />
      </div>
      {!data.hasData && (
        <EmptyState
          icon={Boxes}
          title={t('category.unavailable')}
          description={t('category.unavailableHint')}
        />
      )}
      {data.hasData && data.rows.length === 0 && (
        <EmptyState
          icon={Boxes}
          title={t('overview.noResources')}
          description={t('overview.noResourcesHint')}
        />
      )}
      {data.hasData && data.rows.length > 0 && (
        <>
          <div className="overview-charts">
            {isTags ? (
              <>
                <TagCoverageChart {...chartProps} entries={data.tagCoverage} />
                <CategoryChart
                  {...chartProps}
                  scope={`${scope}:${tagKey}`}
                  field="tagValue"
                  entries={tagEntries}
                  title={t('category.byTag')}
                  subtitle={t('category.oneKey')}
                  formatLabel={formatTag}
                >
                  <div className="category-tag-selector">
                    <Label htmlFor="category-tag-key">{t('category.selectKey')}</Label>
                    <Select
                      id="category-tag-key"
                      disabled={!data.tagKeys.length}
                      value={tagKey}
                      onValueChange={(value) => {
                        setChosenKey(value);
                        setSelected(null);
                      }}
                      options={
                        data.tagKeys.length
                          ? data.tagKeys.map((value) => ({ value, label: value }))
                          : [{ value: '', label: t('category.noKeys') }]
                      }
                    />
                  </div>
                </CategoryChart>
              </>
            ) : (
              <>
                <CategoryChart
                  {...chartProps}
                  field="type"
                  entries={data.types}
                  title={t('category.byType')}
                  subtitle={t('category.clickToExplore')}
                  formatLabel={resourceTypeLabel}
                />
                <CategoryChart
                  {...chartProps}
                  field="location"
                  entries={data.locations}
                  title={t('overview.byLocation')}
                  subtitle={t('category.clickToExplore')}
                />
              </>
            )}
          </div>
          <div className="overview-bottom">
            <SubscriptionList
              entries={data.subscriptionEntries}
              subscription={subscription}
              setSubscription={setSubscription}
            />
            <CategoryChart
              {...chartProps}
              field={data.dimension || 'resourceGroupKey'}
              entries={
                data.dimension
                  ? data.dimensionEntries
                  : countResources(data.rows, 'resourceGroupKey')
              }
              title={
                data.dimension
                  ? t('category.byDimension', { dimension: t(`table.columns.${data.dimension}`) })
                  : t('category.byResourceGroup')
              }
              subtitle={t('category.clickToExplore')}
              formatLabel={data.dimension ? undefined : (value) => resourceGroupLabels.get(value)}
            />
          </div>
          <section className="category-resource-section" aria-labelledby="category-resources-title">
            <div className="category-section-heading">
              <div>
                <h2 id="category-resources-title">{t('category.resourceDetails')}</h2>
                <p role="status">
                  {t(filtered.length === 1 ? 'category.resultsOne' : 'category.results', {
                    count: format(filtered.length),
                  })}
                  {selected ? ` · ${formatSelection()}` : ''}
                </p>
              </div>
              {selected && (
                <Button variant="outline" onClick={() => setSelected(null)}>
                  {t('table.clearFilters')}
                </Button>
              )}
            </div>
            <DataTable
              key={`${scope}:${tagKey}:${JSON.stringify(selected)}`}
              file={file}
              id="resources"
              subscription={subscription}
              label={t('category.resourceDetails')}
            />
          </section>
        </>
      )}
      <CategoryReports reports={data.reports} files={files} scope={scope} />
    </div>
  );
}
