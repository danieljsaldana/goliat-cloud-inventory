import { useMemo } from 'react';
import { useSidebarMenu } from '../hooks/useSidebarMenu.js';
import Sidebar from '../components/Sidebar/index.jsx';
import DashboardBreadcrumb from '../components/DashboardBreadcrumb/index.jsx';
import DashboardHeading from '../components/DashboardHeading/index.jsx';
import DashboardContent from '../components/DashboardContent/index.jsx';
import { REPORTS } from '../../../core/inventory/reports.js';
import { CATEGORY_SUMMARIES } from '@/core/inventory/categories.js';
import { scopeInventory } from '../../../core/inventory/subscriptions.js';
import { dashboardCopy } from '../utils/dashboardCopy.js';
import './DashboardPage.css';
import { Sheet } from '@/components/ui/primitives/sheet.js';

/** @param {import('../types.js').DashboardPageProps} props */
export default function DashboardPage({
  provider,
  reportId,
  inventory,
  subscription,
  setSubscription,
}) {
  const { menuOpen, changeMenu, closeMenu } = useSidebarMenu();
  const files = useMemo(
    () => scopeInventory(inventory.files, subscription),
    [inventory.files, subscription],
  );
  const report = [...REPORTS, ...CATEGORY_SUMMARIES].find((item) => item.id === reportId);
  const copy = dashboardCopy(provider, report);
  return (
    <Sheet open={menuOpen} onOpenChange={changeMenu}>
      <div className="dashboard-layout">
        <Sidebar provider={provider} active={reportId} files={files} close={closeMenu} />
        <main id="main" tabIndex={-1} className="dashboard-main">
          <DashboardBreadcrumb
            provider={provider}
            label={copy.breadcrumb}
            metadata={inventory.metadata}
          />
          <DashboardHeading provider={provider} copy={copy} inventory={inventory} />
          <DashboardContent
            inventory={inventory}
            files={files}
            reportId={reportId}
            subscription={subscription}
            setSubscription={setSubscription}
          />
        </main>
      </div>
    </Sheet>
  );
}
