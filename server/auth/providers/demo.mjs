import Credentials from 'next-auth/providers/credentials';
import { demoCredentials } from '../../access.mjs';
import { translate } from '../../../src/core/i18n/translate.js';

export function demoProvider(settings) {
  return Credentials({
    id: 'demo',
    name: translate('es', 'auth.demo'),
    credentials: {
      username: { label: translate('es', 'auth.username') },
      password: { label: translate('es', 'auth.password'), type: 'password' },
    },
    authorize: (credentials) => demoCredentials(credentials, settings),
  });
}
