import AppLink from '@/app/routing/AppLink/index.jsx';
import { Button } from '@/components/ui/primitives/button.js';
import { useI18n } from '@/i18n/useI18n.js';
import { REPORT_ICONS } from '../reportIcons.js';

export default function SidebarReportLink({ report, active, file, close }) {
  const { t, format } = useI18n();
  const Icon = REPORT_ICONS[report.icon];
  return (
    <Button asChild variant="ghost" className={`side-link ${active === report.id ? 'active' : ''}`}>
      <AppLink
        to={`/inventario/${report.id}`}
        onClick={close}
        aria-current={active === report.id ? 'page' : undefined}
      >
        <Icon size={16} />
        <span>{t(report.labelKey)}</span>
        {Boolean(file) && <span className="side-count">{format(file.rows.length)}</span>}
      </AppLink>
    </Button>
  );
}
