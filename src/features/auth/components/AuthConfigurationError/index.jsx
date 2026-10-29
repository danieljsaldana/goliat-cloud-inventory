import { translate } from '../../../../core/i18n/translate.js';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/primitives/card.js';
import LoginIntro from '../LoginIntro/index.jsx';
import LoginFooter from '../LoginFooter/index.jsx';

export default function AuthConfigurationError({ locale }) {
  return (
    <div className="login-page">
      <main className="login-main">
        <LoginIntro locale={locale} />
        <div className="login-access">
          <Card className="login-card" role="alert">
            <CardHeader>
              <CardTitle as="h1">{translate(locale, 'auth.unconfigured')}</CardTitle>
              <CardDescription>{translate(locale, 'auth.unconfiguredDescription')}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
      <LoginFooter locale={locale} target={`/${locale}/`} />
    </div>
  );
}
