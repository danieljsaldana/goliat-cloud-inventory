import { Cloud, Database, ShieldCheck } from 'lucide-react';
import { translate } from '@/core/i18n/translate.js';
import { LOGIN_FEATURES } from './constants.js';

export default function LoginIntro({ locale }) {
  const t = (key) => translate(locale, key);
  const icons = { Cloud, Database, ShieldCheck };
  return (
    <section className="login-intro" aria-labelledby="workspace-title">
      <div className="login-brand">
        <span className="login-brand-logo" role="img" aria-label={t('brand.logo')} />
        <span>{t('brand.tagline')}</span>
      </div>
      <div className="login-intro-copy">
        <p className="login-eyebrow">{t('brand.providers')}</p>
        <h2 id="workspace-title">{t('auth.workspaceTitle')}</h2>
        <p>{t('auth.workspaceDescription')}</p>
        <ul className="login-features">
          {LOGIN_FEATURES.map(({ icon, title, description }) => {
            const Icon = icons[icon];
            return (
              <li key={title}>
                <span className="login-feature-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <strong>{t(title)}</strong>
                  <p>{t(description)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
