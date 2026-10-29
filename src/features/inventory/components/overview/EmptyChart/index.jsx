import { Boxes } from 'lucide-react';
import { useI18n } from '../../../../../i18n/useI18n.js';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyDescription,
} from '@/components/ui/primitives/empty.js';

export default function EmptyChart({ message = 'common.noResources', icon: Icon = Boxes }) {
  const { t } = useI18n();
  return (
    <Empty className="chart-empty-state" role="status">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="empty-state-icon">
          <Icon size={28} aria-hidden="true" />
        </EmptyMedia>
        <EmptyDescription>{t(message)}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
