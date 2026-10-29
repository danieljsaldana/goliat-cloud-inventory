import { Cloud } from 'lucide-react';
import { translate } from '@/core/i18n/translate.js';
import './SiteFooter.css';

export default function SiteFooter({ locale, children }) {
  const t = (key) => translate(locale, key);
  return (
    <footer className="site-footer">
      <span>
        <Cloud size={14} aria-hidden="true" />
        {t('brand.name')}
        <span className="footer-divider" />
        <span className="footer-description">{t('common.operations')}</span>
      </span>
      <div className="footer-controls">
        <span className="footer-providers">{t('brand.providers')}</span>
        {children}
      </div>
    </footer>
  );
}
