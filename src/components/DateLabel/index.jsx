import { useI18n } from '../../i18n/useI18n.js';
import './DateLabel.css';

export default function DateLabel({ metadata }) {
  const { t, localeTag } = useI18n();
  const date = new Date(metadata?.generatedAt || NaN);
  const hasDate = Number.isFinite(date.getTime());
  return (
    <span className="date-label">
      {hasDate ? (
        <time dateTime={date.toISOString()}>
          {t('dates.updated', {
            date: date.toLocaleDateString(localeTag, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
          })}
          <span className="date-time">
            {' '}
            · {date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </time>
      ) : (
        <span>{t('dates.unavailable')}</span>
      )}
    </span>
  );
}
