import { test, expect, signIn } from './support/fixtures.mjs';
import { E2E_ORIGIN, E2E_USERNAME, E2E_PASSWORD } from './support/constants.mjs';
import { SIGN_IN_NOTICE_PARAM } from '../../src/features/auth/constants.js';

test('un destino de retorno externo se sustituye por la portada local', async ({
  page,
  locale,
}) => {
  await page.goto(`/login/?locale=${locale}&callbackUrl=https://otro.example/`);
  await page.locator('#username').fill(E2E_USERNAME);
  await page.locator('#password').fill(E2E_PASSWORD);
  await page.locator('.login-form button[type=submit]').click();
  await expect(page).toHaveURL(
    (url) => url.origin === E2E_ORIGIN && url.pathname === `/${locale}/`,
  );
  await expect(page.locator('.provider-grid')).toBeVisible();
});

test('protege páginas y todas las API de datos, incluso con una cookie falsa', async ({
  page,
  request,
  context,
  locale,
}) => {
  await page.goto(`/${locale}/inventario/resources/?scope=demo`);
  await expect(page).toHaveURL(/\/login\//);
  expect(new URL(page.url()).searchParams.get('callbackUrl')).toContain(
    `/${locale}/inventario/resources/`,
  );
  const paths = [
    '/api/inventory/azure/',
    '/api/inventory/azure/resources/',
    '/api/inventory/azure/refresh/',
  ];
  for (const path of paths) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  for (const path of paths.slice(-2)) expect((await request.post(path)).status()).toBe(401);
  await context.addCookies([
    { name: 'authjs.session-token', value: 'sesion-falsificada', url: 'http://127.0.0.1:4100' },
  ]);
  expect((await page.request.get('/api/inventory/azure/')).status()).toBe(401);
});

test('rechaza credenciales incorrectas, permite revelar la contraseña y crea una sesión protegida', async ({
  page,
  context,
  locale,
  t,
}) => {
  await page.goto(`/login/?locale=${locale}&callbackUrl=/${locale}/inventario/`);
  await page.getByLabel(t('auth.username'), { exact: true }).fill(E2E_USERNAME);
  await page.getByLabel(t('auth.password'), { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: t('auth.showPassword') }).click();
  await expect(page.locator('#password')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: t('auth.hidePassword') }).click();
  await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: t('auth.signIn'), exact: true }).click();
  await expect(page.locator('#login-error')).toContainText(t('auth.failed'));
  await page.locator('#username').fill(E2E_USERNAME);
  await page.locator('#password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: t('auth.signIn'), exact: true }).click();
  await expect(page).toHaveURL(
    (url) => url.origin === E2E_ORIGIN && url.pathname === `/${locale}/inventario/`,
  );
  await expect(page.locator('[data-sonner-toast][data-type=success]')).toContainText(
    t('notifications.signedIn'),
  );
  await expect(page.locator('[data-sonner-toaster]')).toHaveAttribute('data-x-position', 'right');
  await expect(page.locator('[data-sonner-toaster]')).toHaveAttribute('data-y-position', 'top');
  expect(new URL(page.url()).searchParams.has(SIGN_IN_NOTICE_PARAM)).toBe(false);
  const cookie = (await context.cookies()).find(({ name }) => name === 'authjs.session-token');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  expect(cookie.value).not.toContain(E2E_PASSWORD);
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(8 * 3600 - 60);
  expect(cookie.expires - Date.now() / 1000).toBeLessThanOrEqual(8 * 3600 + 30);
  const session = await (await page.request.get('/api/auth/session/')).json();
  expect(session.user.name).toBe(E2E_USERNAME);
  expect(JSON.stringify(session)).not.toContain(E2E_PASSWORD);
  await page.reload();
  await expect(page.locator('.kpi-grid')).toBeVisible();
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
});

test('la tarjeta de sesión abre el perfil propio y permite volver al inicio', async ({
  signedInPage: page,
  t,
  locale,
}) => {
  await page.getByRole('button', { name: t('auth.account') }).click();
  await page.getByRole('menuitem', { name: t('profile.view') }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/profile/$`));
  await expect(page.getByRole('heading', { name: t('profile.title'), exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: E2E_USERNAME, exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText(t('members.role.member'));
  await expect(page.locator('main')).toContainText(t('profile.emailUnavailable'));
  await page.reload();
  await expect(page.getByRole('heading', { name: t('profile.title'), exact: true })).toBeVisible();
  await page.getByRole('link', { name: t('profile.backHome') }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/$`));
});

test('el menú muestra el avatar predeterminado y cerrar sesión revoca el acceso', async ({
  signedInPage: page,
  t,
  locale,
}) => {
  await expect(
    page.locator('.account-menu').getByRole('img', { name: t('auth.defaultAvatar') }),
  ).toBeVisible();
  await page.getByRole('button', { name: t('auth.account') }).click();
  await expect(page.getByRole('menu')).toContainText(t('auth.signedInAs'));
  await page.getByRole('menuitem', { name: t('auth.signOut') }).click();
  await expect(page).toHaveURL(new RegExp(`/login/\\?locale=${locale}`));
  await page.goto(`/${locale}/`);
  await expect(page).toHaveURL(/\/login\//);
});

test('la selección de idioma del login conserva el destino y el formulario funciona sin JavaScript', async ({
  page,
  browser,
  locale,
  t,
}) => {
  await page.goto(`/login/?locale=${locale}&callbackUrl=/${locale}/inventario/resources/`);
  await page.getByRole('combobox', { name: t('language.label') }).click();
  const next = locale === 'es' ? 'en' : 'es';
  await page
    .getByRole('option', { name: next === 'en' ? 'English' : 'Español', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`locale=${next}`));
  expect(new URL(page.url()).searchParams.get('callbackUrl')).toBe(
    `/${next}/inventario/resources/`,
  );
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const withoutJs = await context.newPage();
    await signIn(withoutJs, locale);
    expect((await withoutJs.request.get('/api/inventory/azure/')).status()).toBe(200);
  } finally {
    await context.close();
  }
});
