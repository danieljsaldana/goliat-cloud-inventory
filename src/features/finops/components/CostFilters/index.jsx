import { Label } from '@/components/ui/primitives/label.js';
import Select from '@/components/ui/Select/index.jsx';
import { useI18n } from '@/i18n/useI18n.js';

export default function CostFilters({
  month,
  basis,
  subscription,
  currency,
  months,
  subscriptions,
  currencies,
  onMonth,
  onBasis,
  onSubscription,
  onCurrency,
  loading,
}) {
  const { t } = useI18n();
  return (
    <section className="finops-filters" aria-label={t('finops.filters')}>
      <Label className="finops-filter">
        {t('finops.period')}
        <Select value={month} onValueChange={onMonth} options={months} />
      </Label>
      <Label className="finops-filter">
        {t('finops.basis')}
        <Select
          value={basis}
          onValueChange={onBasis}
          options={[
            { value: 'ActualCost', label: t('finops.actual') },
            { value: 'AmortizedCost', label: t('finops.amortized') },
          ]}
        />
      </Label>
      <Label className="finops-filter">
        {t('subscriptions.label')}
        <Select
          value={subscription}
          onValueChange={onSubscription}
          disabled={loading || !subscriptions.length}
          options={[
            { value: '', label: t('subscriptions.all') },
            ...subscriptions.map(({ id, name }) => ({ value: id, label: name })),
          ]}
        />
      </Label>
      <Label className="finops-filter finops-currency">
        {t('finops.currency')}
        <Select
          value={currency}
          onValueChange={onCurrency}
          disabled={loading || !currencies.length}
          options={
            currencies.length
              ? currencies.map((value) => ({ value, label: value }))
              : [{ value: '', label: '—' }]
          }
        />
      </Label>
    </section>
  );
}
