import { useI18n } from '../../i18n/useI18n.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/primitives/select.js';
import { METRIC_PERIODS } from './metricPeriods.js';

export default function MetricPeriodSelect({ hours, onChange, disabled }) {
  const { t } = useI18n();
  return (
    <Select
      value={String(hours)}
      onValueChange={(value) => onChange(Number(value))}
      disabled={disabled}
    >
      <SelectTrigger size="sm" aria-label={t('admin.periodSelector')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {METRIC_PERIODS.map((period) => (
          <SelectItem key={period} value={String(period)}>
            {t(period === 168 ? 'admin.periodWeek' : 'admin.periodHours', { count: period })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
