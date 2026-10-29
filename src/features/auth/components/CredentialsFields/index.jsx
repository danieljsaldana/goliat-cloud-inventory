import { translate } from '../../../../core/i18n/translate.js';
import { Input } from '@/components/ui/primitives/input.js';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/primitives/field.js';
import PasswordField from '../PasswordField/index.jsx';

export default function CredentialsFields({ locale, pending, error }) {
  return (
    <FieldGroup className="gap-5">
      <Field className="login-field" data-invalid={error}>
        <FieldLabel htmlFor="username">{translate(locale, 'auth.username')}</FieldLabel>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          required
          maxLength={256}
          disabled={pending}
          aria-invalid={error}
          aria-describedby={error ? 'login-error' : undefined}
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>
      <PasswordField locale={locale} pending={pending} error={error} />
    </FieldGroup>
  );
}
