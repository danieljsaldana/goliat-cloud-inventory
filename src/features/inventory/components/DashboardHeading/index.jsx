import RefreshButton from '../../../../components/ui/RefreshButton/index.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';

export default function DashboardHeading({ provider, copy, inventory }) {
  const { t } = useI18n();
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{t(`providers.${provider}Vendor`)}</span>
        <h1>{t(copy.title)}</h1>
        {Boolean(copy.description) && <p>{t(copy.description)}</p>}
      </div>
      {provider === 'azure' && (
        <RefreshButton
          provider="azure"
          className="refresh-button"
          onRefresh={inventory.reload}
          loading={inventory.loading}
        />
      )}
    </div>
  );
}
