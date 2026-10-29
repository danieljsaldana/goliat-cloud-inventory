import { useI18n } from '@/i18n/useI18n.js';
import Select from '@/components/ui/Select/index.jsx';
import ChartCard from '../../overview/ChartCard/index.jsx';
import Bars from '../../overview/Bars/index.jsx';

export default function CategoryChart({
  field,
  entries,
  title,
  subtitle,
  formatLabel,
  scope,
  selected,
  onSelect,
  children,
}) {
  const { t, format } = useI18n();
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {children}
      <Bars
        entries={entries}
        compact
        scope={scope}
        label={title}
        formatLabel={formatLabel}
        onSelect={(value) => onSelect(field, value)}
      />
      <Select
        aria-label={t('category.exploreChart', { chart: title })}
        value={selected?.field === field ? JSON.stringify([selected.value]) : 'all'}
        onValueChange={(value) => onSelect(field, value === 'all' ? null : JSON.parse(value)[0])}
        options={[
          { value: 'all', label: t('category.allResources') },
          ...entries.map(([value, count]) => ({
            value: JSON.stringify([value]),
            label: `${(formatLabel ? formatLabel(value) : value) || t('common.unspecified')} · ${format(count)}`,
          })),
        ]}
      />
    </ChartCard>
  );
}
