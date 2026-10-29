import { LockKeyhole } from 'lucide-react';
import { translate } from '../../../../core/i18n/translate.js';
import LoginForm from '../LoginForm/index.jsx';
import LoginIntro from '../LoginIntro/index.jsx';
import LoginFooter from '../LoginFooter/index.jsx';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/primitives/card.js';

export default function LoginCard({ mode, locale, target, initialError }) {
  const t = (key, values) => translate(locale, key, values);
  return (
    <div className="login-page">
      <main className="login-main">
        <LoginIntro locale={locale} />
        <div className="login-access">
          <Card as="section" className="login-card" aria-labelledby="login-title">
            <CardHeader>
              <CardTitle as="h1" id="login-title" className="flex items-center gap-2">
                <LockKeyhole className="size-5 shrink-0 text-primary" aria-hidden="true" />
                {t('auth.title')}
              </CardTitle>
              <CardDescription>
                {t(mode === 'demo' ? 'auth.demoDescription' : 'auth.azureDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm mode={mode} locale={locale} target={target} initialError={initialError} />
            </CardContent>
            {mode === 'azure-ad' && (
              <CardFooter>
                <LockKeyhole size={14} aria-hidden="true" />
                <span>{t('auth.authenticationMethod', { method: t('auth.azureAd') })}</span>
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
      <LoginFooter locale={locale} target={target} />
    </div>
  );
}
