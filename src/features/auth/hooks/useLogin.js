import { useActionState } from 'react';
import { loginAction } from '../../../../app/login/actions.js';

export function useLogin({ locale, target, initialError }) {
  const [state, action, pending] = useActionState(
    loginAction.bind(null, { locale, target }),
    { error: initialError ? 'auth.failed' : null },
    `/login/?locale=${locale}&callbackUrl=${encodeURIComponent(target)}`,
  );
  return { action, pending, error: state?.error };
}
