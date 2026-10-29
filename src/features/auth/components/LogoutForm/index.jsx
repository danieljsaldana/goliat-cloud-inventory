'use client';

import { useActionState } from 'react';
import { LogOut, LoaderCircle } from 'lucide-react';
import { logoutAction } from '../../../../../app/login/actions.js';
import { useI18n } from '@/i18n/useI18n.js';
import { Button } from '@/components/ui/primitives/button.js';
import { DropdownMenuItem } from '@/components/ui/primitives/dropdown-menu.js';
import { Alert, AlertDescription } from '@/components/ui/primitives/alert.js';

export default function LogoutForm({ dropdown = true }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(logoutAction.bind(null, locale), null);
  const button = (
    <Button
      type="submit"
      variant="ghost"
      className={dropdown ? 'w-full justify-start focus-visible:ring-0' : 'w-full justify-start'}
      disabled={pending}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <LogOut aria-hidden="true" />
      )}
      {t(pending ? 'auth.signingOut' : 'auth.signOut')}
    </Button>
  );
  return (
    <form action={action} aria-busy={pending}>
      {dropdown ? (
        <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()} disabled={pending}>
          {button}
        </DropdownMenuItem>
      ) : (
        button
      )}
      {Boolean(state?.error) && (
        <Alert variant="destructive">
          <AlertDescription>{t(state.error)}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
