'use client';

import { translate } from '../../../../core/i18n/translate.js';
import { useLogin } from '../../hooks/useLogin.js';
import CredentialsFields from '../CredentialsFields/index.jsx';
import { Button } from '@/components/ui/primitives/button.js';
import { Alert, AlertDescription } from '@/components/ui/primitives/alert.js';
import { CircleAlert, LoaderCircle, LogIn } from 'lucide-react';

export default function LoginForm({ mode, locale, target, initialError }) {
  const { pending, error, action } = useLogin({ locale, target, initialError });
  const methodLabel = mode === 'azure-ad' ? 'auth.microsoft' : 'auth.signIn';
  const label = pending ? 'auth.pending' : methodLabel;
  return (
    <form className="login-form" action={action} aria-busy={pending} noValidate>
      {mode === 'demo' && (
        <CredentialsFields locale={locale} pending={pending} error={Boolean(error)} />
      )}
      {Boolean(error) && (
        <Alert variant="destructive" id="login-error">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{translate(locale, error)}</AlertDescription>
        </Alert>
      )}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <LogIn aria-hidden="true" />
        )}
        {translate(locale, label)}
      </Button>
    </form>
  );
}
