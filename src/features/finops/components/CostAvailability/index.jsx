import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/primitives/alert.js';
import { useI18n } from '@/i18n/useI18n.js';

export default function CostAvailability({ subscriptions }) {
  const { t } = useI18n();
  const missing = subscriptions.filter(({ status }) => status !== 'ready');
  if (!missing.length) return null;
  return (
    <Alert className="finops-availability">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>
        <strong>{t('finops.partial')}</strong>
        <p>{t('finops.partialHelp')}</p>
        <ul>
          {missing.map(({ id, name, status }) => (
            <li key={id}>
              {name}: {t(`finops.status.${status}`)}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
