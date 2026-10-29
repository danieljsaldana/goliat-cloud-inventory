import { authenticationProviders } from './auth/providers/index.mjs';
import { authenticationSettings, safeAuthRedirect } from './access.mjs';
import { getLogger } from './logging/logger.mjs';
import { applicationAdministrator } from './access/applicationAdministrator.mjs';

export function authConfiguration(env = process.env) {
  const settings = authenticationSettings(env);
  const providers = authenticationProviders(settings);
  return {
    providers,
    secret: settings.secret,
    trustHost: true,
    useSecureCookies: settings.secureCookies,
    session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
    pages: { signIn: '/login/', error: '/login/' },
    callbacks: {
      signIn({ account, profile }) {
        if (!settings.enabled) return false;
        if (settings.mode === 'demo') return account?.provider === 'demo';
        return (
          account?.provider === 'microsoft-entra-id' &&
          typeof profile?.tid === 'string' &&
          profile.tid.toLowerCase() === settings.tenantId
        );
      },
      jwt({ token, account, profile }) {
        if (account) {
          token.authMode = settings.mode;
          delete token.identity;
          if (
            account.provider === 'microsoft-entra-id' &&
            typeof profile?.tid === 'string' &&
            profile.tid.toLowerCase() === settings.tenantId
          )
            token.identity = { objectId: profile.oid, tenantId: profile.tid.toLowerCase() };
        }
        return token;
      },
      async session({ session, token }) {
        session.authMode = token.authMode;
        session.identity = token.identity;
        session.administrator = await applicationAdministrator(session, settings, env);
        return session;
      },
      redirect({ url }) {
        return safeAuthRedirect(url, settings.url);
      },
    },
    logger: {
      error(error) {
        getLogger().error(
          { err: error, event: 'authentication.failed' },
          'Error de autenticación.',
        );
      },
      warn(code) {
        getLogger().warn(
          { err: { name: 'AuthenticationWarning', code }, event: 'authentication.warning' },
          'Advertencia de autenticación.',
        );
      },
      debug() {},
    },
  };
}
