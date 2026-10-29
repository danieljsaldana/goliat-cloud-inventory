import { useI18n } from '@/i18n/useI18n.js';

export default function CostSummary({ summary, money }) {
  const { t, format } = useI18n();
  return (
    <section className="finops-summary" aria-label={t('finops.summary')}>
      <div className="finops-total">
        <h2>{t(summary.partial ? 'finops.partialTotal' : 'finops.total')}</h2>
        <strong>{money(summary.total)}</strong>
        <p>{t('finops.beforeTax')}</p>
      </div>
      <dl className="finops-summary-details">
        <div>
          <dt>{t('finops.services')}</dt>
          <dd>{format(summary.services)}</dd>
        </div>
        <div>
          <dt>{t('finops.chargedResources')}</dt>
          <dd>{format(summary.chargedResources)}</dd>
        </div>
        <div>
          <dt>{t('finops.availableSubscriptions')}</dt>
          <dd>
            {t('finops.coverage', {
              available: summary.subscriptions.filter(({ status }) => status === 'ready').length,
              total: summary.subscriptions.length,
            })}
          </dd>
        </div>
      </dl>
    </section>
  );
}
