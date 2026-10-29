import { ArrowRight, CircleCheck, Clock3, Info } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import AppLink from '../../app/routing/AppLink/index.jsx';
import { Button } from '../../components/ui/primitives/button.js';
import { inventorySyncState } from './utils/inventorySyncState.js';

export default function InventorySyncStatus({
  importedAt,
  publishedAt,
  importedEtag,
  publishedEtag,
}) {
  const { t } = useI18n();
  const state = inventorySyncState(importedAt, publishedAt, { importedEtag, publishedEtag });
  const Icon = {
    synced: CircleCheck,
    storageNewer: Clock3,
    webNewer: Info,
    unknown: Info,
    changed: Clock3,
    timestampsMatch: Info,
  }[state];
  return (
    <div className={`admin-sync admin-sync-${state}`} role="status">
      <Icon size={19} aria-hidden="true" />
      <div>
        <strong>{t(`admin.sync.${state}`)}</strong>
        <p>{t(`admin.sync.${state}Help`)}</p>
      </div>
      {['storageNewer', 'changed'].includes(state) && (
        <Button variant="outline" asChild>
          <AppLink to="/inventario/">
            {t('admin.openInventory')} <ArrowRight size={15} aria-hidden="true" />
          </AppLink>
        </Button>
      )}
    </div>
  );
}
