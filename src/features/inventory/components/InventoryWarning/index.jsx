import { useState } from 'react';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/primitives/alert.js';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/primitives/collapsible.js';
import { Button } from '@/components/ui/primitives/button.js';
import { useI18n } from '@/i18n/useI18n.js';
import { REPORTS } from '@/core/inventory/reports.js';
import { groupInventoryErrors } from '../../utils/groupInventoryErrors.js';
import './InventoryWarning.css';

export default function InventoryWarning({ errors }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const groups = groupInventoryErrors(errors);
  const sharedError = groups.length === 1 ? groups[0] : null;
  return (
    <Alert className="load-warning">
      <AlertDescription className="load-warning-description">
        <Collapsible className="load-warning-body" open={open} onOpenChange={setOpen}>
          <div className="load-warning-summary">
            <span className="load-warning-icon" aria-hidden="true">
              <TriangleAlert />
            </span>
            <div className="load-warning-copy">
              <strong className="load-warning-title">
                {t(errors.length === 1 ? 'dashboard.loadWarningOne' : 'dashboard.loadWarningMany', {
                  count: errors.length,
                })}
              </strong>
              <p>
                {sharedError && (
                  <>{t(`errors.${sharedError.code}`, { status: sharedError.status })} </>
                )}
                {t('dashboard.retryHint')}
              </p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="load-warning-trigger">
                {t(open ? 'dashboard.hideWarningDetails' : 'dashboard.showWarningDetails')}
                <ChevronDown className="load-warning-chevron" aria-hidden="true" />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="load-warning-content">
            <div
              className="load-warning-details"
              role="region"
              aria-label={t('dashboard.affectedViews')}
              tabIndex={0}
            >
              <ul className="load-warning-groups">
                {groups.map((group) => (
                  <li key={group.key}>
                    <p className="load-warning-group-title">
                      {sharedError
                        ? t('dashboard.affectedViews')
                        : t(`errors.${group.code}`, { status: group.status })}
                      <span className="load-warning-count">{group.reports.length}</span>
                    </p>
                    <ul className="load-warning-views">
                      {group.reports.map((id) => (
                        <li key={id}>
                          {t(REPORTS.find((report) => report.id === id)?.labelKey || id)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </AlertDescription>
    </Alert>
  );
}
