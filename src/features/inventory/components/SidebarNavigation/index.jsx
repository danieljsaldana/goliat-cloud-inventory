import AppLink from '../../../../app/routing/AppLink/index.jsx';
import { LayoutDashboard, Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/primitives/input.js';
import ProviderMark from '../../../../components/branding/ProviderMark/index.jsx';
import { REPORT_GROUPS, REPORTS } from '../../../../core/inventory/reports.js';
import { CATEGORY_SUMMARIES } from '@/core/inventory/categories.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import SidebarGroup from '../SidebarGroup/index.jsx';
import { Button } from '@/components/ui/primitives/button.js';

export default function SidebarNavigation({ provider, active, files, close }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const search = query.trim().toLocaleLowerCase();
  const navigationReports = [...CATEGORY_SUMMARIES, ...REPORTS];
  const matchingReports = navigationReports.filter((report) =>
    `${t(report.labelKey)} ${report.id}`.toLocaleLowerCase().includes(search),
  );
  const groups = REPORT_GROUPS.filter((group) =>
    matchingReports.some((report) => report.group === group.id),
  );
  const activeGroup = navigationReports.find((report) => report.id === active)?.group;
  return (
    <>
      <div className="sidebar-provider">
        <ProviderMark provider={provider} />
        <div>
          {t(`providers.${provider}Name`)}
          <small>{t('nav.inventoryDashboard')}</small>
        </div>
      </div>
      <div className="sidebar-search">
        <Search size={16} aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('nav.searchServices')}
          aria-label={t('nav.searchServices')}
        />
      </div>
      <nav aria-label={t('nav.providerInventory', { provider: t(`providers.${provider}`) })}>
        <Button asChild variant="ghost" className={`side-link ${!active ? 'active' : ''}`}>
          <AppLink to="/inventario" onClick={close} aria-current={!active ? 'page' : undefined}>
            <LayoutDashboard size={17} />
            {t('nav.overview')}
          </AppLink>
        </Button>
        {provider === 'azure' &&
          groups.map((group) => (
            <SidebarGroup
              key={`${group.id}-${activeGroup || ''}-${Boolean(search)}`}
              group={group}
              reports={matchingReports.filter((report) => report.group === group.id)}
              searching={Boolean(search)}
              activeGroup={activeGroup}
              active={active}
              files={files}
              close={close}
            />
          ))}
        {Boolean(search) && !matchingReports.length && (
          <p className="sidebar-no-results" role="status">
            {t('nav.noMatchingServices')}
          </p>
        )}
      </nav>
    </>
  );
}
