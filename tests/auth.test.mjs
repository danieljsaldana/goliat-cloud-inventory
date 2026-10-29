import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticationSettings,
  demoCredentials,
  dashboardSessionAllowed,
  safeReturnPath,
  safeAuthRedirect,
} from '../server/access.mjs';
import { authConfiguration } from '../server/auth-config.mjs';

const demo = {
  DASHBOARD_AUTH_ENABLED: 'true',
  DASHBOARD_AUTH_MODE: 'demo',
  AUTH_SECRET: 'test-only-secret-with-at-least-32-bytes',
  AUTH_URL: 'https://dashboard.example',
  DASHBOARD_USERNAME: 'demo',
  DASHBOARD_PASSWORD: 'test-only-password',
};
const tenant = '11111111-1111-4111-8111-111111111111';
const azure = {
  ...demo,
  DASHBOARD_AUTH_MODE: 'azure-ad',
  AUTH_MICROSOFT_ENTRA_ID_ID: '22222222-2222-4222-8222-222222222222',
  AUTH_MICROSOFT_ENTRA_ID_SECRET: 'test-client-secret',
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: `https://login.microsoftonline.com/${tenant}/v2.0`,
};

test('la desactivación es explícita y la configuración incompleta no abre el panel', () => {
  for (const env of [
    { ...demo, DASHBOARD_AUTH_ENABLED: 'yes' },
    { ...demo, DASHBOARD_AUTH_MODE: 'unknown' },
    { ...demo, AUTH_SECRET: 'short' },
    { ...demo, DASHBOARD_PASSWORD: '' },
    { ...demo, AUTH_URL: 'http://remote.example', NODE_ENV: 'production' },
    { ...demo, AUTH_URL: 'https://user:password@dashboard.example' },
  ])
    assert.throws(() => authenticationSettings(env));
  assert.deepEqual(
    authenticationSettings({ DASHBOARD_AUTH_ENABLED: 'false', DASHBOARD_AUTH_MODE: 'unknown' }),
    { enabled: false },
  );
  assert.equal(
    authenticationSettings({ ...demo, AUTH_URL: 'http://localhost:3000', NODE_ENV: 'production' })
      .secureCookies,
    false,
  );
  assert.equal(authenticationSettings(demo).secureCookies, true);
});

test('demo rechaza entradas malformadas y no está disponible en modo Azure AD', () => {
  const settings = authenticationSettings(demo);
  for (const credentials of [
    { username: 'wrong', password: demo.DASHBOARD_PASSWORD },
    { username: 'demo', password: [] },
    { username: 'demo', password: 'x'.repeat(1025) },
    {},
  ])
    assert.equal(demoCredentials(credentials, settings), null);
  assert.equal(
    demoCredentials(
      { username: 'demo', password: demo.DASHBOARD_PASSWORD },
      authenticationSettings(azure),
    ),
    null,
  );
});

test('Azure AD exige un tenant concreto y rechaza perfiles de otro tenant', () => {
  for (const issuer of [
    'https://login.microsoftonline.com/common/v2.0',
    'https://login.microsoftonline.com/organizations/v2.0',
    'https://malicious.example/tenant/v2.0',
  ])
    assert.throws(() =>
      authenticationSettings({ ...azure, AUTH_MICROSOFT_ENTRA_ID_ISSUER: issuer }),
    );
  const config = authConfiguration(azure);
  assert.equal(config.providers.length, 1);
  assert.equal(config.providers[0].id, 'microsoft-entra-id');
  assert.equal(
    config.callbacks.signIn({
      account: { provider: 'microsoft-entra-id' },
      profile: { tid: tenant },
    }),
    true,
  );
  assert.equal(
    config.callbacks.signIn({
      account: { provider: 'microsoft-entra-id' },
      profile: { tid: 'other' },
    }),
    false,
  );
  assert.equal(
    config.callbacks.signIn({ account: { provider: 'demo' }, profile: { tid: tenant } }),
    false,
  );
});

test('una sesión de otro modo no obtiene acceso al cambiar la configuración', async () => {
  const settings = authenticationSettings(demo);
  assert.equal(dashboardSessionAllowed(null, settings), false);
  assert.equal(
    dashboardSessionAllowed({ user: { name: 'demo' }, authMode: 'azure-ad' }, settings),
    false,
  );
  assert.equal(
    dashboardSessionAllowed({ user: { name: 'demo' }, authMode: 'demo' }, settings),
    true,
  );
  assert.equal(dashboardSessionAllowed(null, { enabled: false }), true);
  const config = authConfiguration(demo);
  const token = config.callbacks.jwt({ token: {}, account: { provider: 'demo' } });
  assert.equal((await config.callbacks.session({ session: { user: {} }, token })).authMode, 'demo');
});

test('los destinos de vuelta no redirigen a otros dominios', () => {
  for (const target of [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/es/\r\nLocation: x',
  ])
    assert.equal(safeReturnPath(target), '/es/');
  assert.equal(
    safeReturnPath('/en/inventario/virtual-machines/?group=test'),
    '/en/inventario/virtual-machines/?group=test',
  );
  assert.equal(
    safeAuthRedirect('//evil.example', 'https://dashboard.example'),
    'https://dashboard.example/es/',
  );
  assert.equal(
    safeAuthRedirect('/en/', 'https://dashboard.example'),
    'https://dashboard.example/en/',
  );
});
