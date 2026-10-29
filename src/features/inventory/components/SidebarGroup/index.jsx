import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/primitives/collapsible.js';
import { Button } from '@/components/ui/primitives/button.js';
import { useI18n } from '@/i18n/useI18n.js';
import SidebarReportLink from '../SidebarReportLink/index.jsx';

export default function SidebarGroup({
  group,
  reports,
  searching,
  activeGroup,
  active,
  files,
  close,
}) {
  const { t } = useI18n();
  return (
    <Collapsible
      className="side-group"
      defaultOpen={searching || group.id === 'inventory' || group.id === activeGroup}
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="side-group-trigger">
          <span>{t(group.labelKey)}</span>
          <ChevronDown size={13} aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {reports.map((report) => (
          <SidebarReportLink
            key={report.id}
            report={report}
            active={active}
            file={files[report.id]}
            close={close}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
