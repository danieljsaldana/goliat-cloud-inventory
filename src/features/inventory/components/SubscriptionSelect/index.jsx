import './SubscriptionSelect.css';
import Select from '../../../../components/ui/Select/index.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';

export default function SubscriptionSelect({
  subscriptions,
  subscription,
  setSubscription,
  loading,
}) {
  const { t } = useI18n();
  const selected = subscriptions.find((item) => item.id === subscription);
  return (
    <div className="header-scope">
      <Select
        className="subscription-select"
        id="azure-subscription"
        aria-label={t('subscriptions.label')}
        title={selected?.name || t('subscriptions.all')}
        value={subscription}
        disabled={loading || !subscriptions.length}
        onValueChange={setSubscription}
        options={[
          { value: '', label: t('subscriptions.all') },
          ...(loading && subscription && !selected
            ? [{ value: subscription, label: t('subscriptions.loadingSaved') }]
            : []),
          ...subscriptions.map(({ id, name, state }) => ({
            value: id,
            label: state === 'Disabled' ? t('subscriptions.disabledOption', { name }) : name,
          })),
        ]}
      />
    </div>
  );
}
