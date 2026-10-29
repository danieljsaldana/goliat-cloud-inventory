import { SheetContent, SheetTitle, SheetDescription } from '@/components/ui/primitives/sheet.js';
import { useI18n } from '@/i18n/useI18n.js';
import SidebarNavigation from '../SidebarNavigation/index.jsx';
import './Sidebar.css';

export default function Sidebar({ provider, active, files, close }) {
  const { t } = useI18n();
  return (
    <>
      <aside className="sidebar">
        <SidebarNavigation provider={provider} active={active} files={files} close={close} />
      </aside>
      <SheetContent side="left" className="mobile-sidebar" closeLabel={t('nav.closeMenu')}>
        <SheetTitle className="sr-only">
          {t('nav.providerInventory', { provider: t('providers.' + provider) })}
        </SheetTitle>
        <SheetDescription className="sr-only">{t('nav.inventoryDashboard')}</SheetDescription>
        <SidebarNavigation provider={provider} active={active} files={files} close={close} />
      </SheetContent>
    </>
  );
}
