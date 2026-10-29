'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '../../auth.js';
import { authenticationStatus } from '../../server/authentication-status.mjs';
import { safeReturnPath } from '../../server/access.mjs';
import { signInReturnPath } from '../../src/features/auth/utils/signInReturnPath.js';

export async function loginAction({ locale, target }, _previous, formData) {
  const language = locale === 'en' ? 'en' : 'es';
  const destination = safeReturnPath(target, `/${language}/`);
  const settings = authenticationStatus();
  if (!settings) return { error: 'auth.unconfiguredDescription' };
  if (!settings.enabled) redirect(destination);
  const authenticatedDestination = signInReturnPath(destination, settings.url);
  try {
    if (settings.mode === 'azure-ad') {
      await signIn('microsoft-entra-id', { redirectTo: authenticatedDestination });
    } else {
      await signIn('demo', {
        username: formData.get('username'),
        password: formData.get('password'),
        redirectTo: authenticatedDestination,
      });
    }
  } catch (error) {
    if (error instanceof AuthError) return { error: 'auth.failed' };
    throw error;
  }
}

export async function logoutAction(locale) {
  const language = locale === 'en' ? 'en' : 'es';
  try {
    await signOut({ redirectTo: `/login/?locale=${language}` });
  } catch (error) {
    if (error instanceof AuthError) return { error: 'auth.signOutFailed' };
    throw error;
  }
}
