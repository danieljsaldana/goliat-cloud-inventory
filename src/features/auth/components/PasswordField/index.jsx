'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/primitives/input.js';
import { Field, FieldLabel } from '@/components/ui/primitives/field.js';
import { Button } from '@/components/ui/primitives/button.js';
import { translate } from '@/core/i18n/translate.js';

export default function PasswordField({ locale, pending, error }) {
  const [visible, setVisible] = useState(false);
  const description = translate(locale, visible ? 'auth.hidePassword' : 'auth.showPassword');
  return (
    <Field className="login-field" data-invalid={error}>
      <FieldLabel htmlFor="password">{translate(locale, 'auth.password')}</FieldLabel>
      <div className="relative">
        <Input
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          className="pr-12"
          required
          maxLength={1024}
          disabled={pending}
          aria-invalid={error}
          aria-describedby={error ? 'login-error' : undefined}
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-label={description}
          aria-pressed={visible}
          disabled={pending}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
    </Field>
  );
}
