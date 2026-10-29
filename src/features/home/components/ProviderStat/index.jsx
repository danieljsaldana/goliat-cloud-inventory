import { useI18n } from '../../../../i18n/useI18n.js';

export default function ProviderStat({ value, label }) {
  const { t, format } = useI18n();
  return (
    <div>
      <strong>{value === null ? t('common.emptyValue') : format(value)}</strong>
      <span>{t(label)}</span>
    </div>
  );
}
