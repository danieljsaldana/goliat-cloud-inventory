import { test, expect, signIn } from './support/fixtures.mjs';

test('Miembros exige sesión y administrador; una cuenta demo no obtiene permisos ni ve usuarios', async ({
  page,
  request,
  locale,
  t,
}) => {
  const anonymous = await request.get('/api/admin/members/');
  expect(anonymous.status()).toBe(401);
  const photoUrl = '/api/admin/members/11111111-1111-4111-8111-111111111111/photo/';
  expect((await request.get(photoUrl)).status()).toBe(401);
  await page.goto(`/${locale}/members/`);
  await expect(page).toHaveURL(/\/login\//);
  await signIn(page, locale);
  await expect(page.locator('.top-nav')).not.toContainText(t('members.title'));
  const denied = await page.request.get('/api/admin/members/');
  expect(denied.status()).toBe(403);
  expect(await denied.json()).toEqual({ error: 'administrator_required' });
  expect((await page.request.get(photoUrl)).status()).toBe(403);
  const write = await page.request.post('/api/admin/members/', {
    data: {
      objectId: '11111111-1111-4111-8111-111111111111',
      role: 'administrator',
      expectedRole: 'member',
    },
  });
  expect(write.status()).toBe(403);
  const forbiddenPage = await page.goto(`/${locale}/members/`);
  expect(forbiddenPage.status()).toBe(404);
  await expect(page.locator('.members-table')).toHaveCount(0);
});
