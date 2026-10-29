import { test, expect } from './support/fixtures.mjs';
import { E2E_ORIGIN } from './support/constants.mjs';
import { getPageMetadata } from '../../src/core/sharing/metadata.js';

test('las redes sociales reciben los metadatos originales y la portada pública sin iniciar sesión', async ({
  page,
  request,
  locale,
}) => {
  const metadata = getPageMetadata(['inventario', 'postgresql'], locale, `${E2E_ORIGIN}/`);
  const response = await request.get(`/${locale}/inventario/postgresql/`, {
    headers: { 'user-agent': 'facebookexternalhit/1.1' },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
  await page.setContent(await response.text());
  await expect(page.locator('head title')).toHaveCount(1);
  await expect(page).toHaveTitle(metadata.title);
  for (const [property, value] of Object.entries({
    'og:title': metadata.title,
    'og:description': metadata.description,
    'og:url': metadata.url,
    'og:image': metadata.image,
    'og:image:type': 'image/png',
  })) {
    await expect(page.locator(`head meta[property="${property}"]`)).toHaveAttribute(
      'content',
      value,
    );
  }
  await expect(page.locator('head meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  await expect(page.locator('head meta[name="twitter:image"]')).toHaveAttribute(
    'content',
    metadata.image,
  );
  await expect(page.locator('script')).toHaveCount(0);
  const image = await request.get('/social/cloud-inventory.png');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');
  expect((await image.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('el navegador sigue pasando por el login y conserva los metadatos del enlace', async ({
  page,
  request,
  locale,
  t,
}) => {
  const metadata = getPageMetadata(['inventario', 'functions'], locale, `${E2E_ORIGIN}/`);
  const response = await request.get(`/${locale}/inventario/functions/`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  await page.goto(`/${locale}/inventario/functions/`);
  await expect(page).toHaveURL(/\/login\//);
  await expect(page).toHaveTitle(t('auth.pageTitle'));
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    metadata.title,
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    metadata.description,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    metadata.image,
  );
  await expect(page.locator('#username')).toBeVisible();
});

test('imitar una red social no permite consultar ni actualizar datos protegidos', async ({
  request,
  locale,
}) => {
  const headers = { 'user-agent': 'Twitterbot/1.0', cookie: 'authjs.session-token=fake-session' };
  for (const path of [
    '/api/inventory/azure/',
    '/api/inventory/azure/postgresql/',
    '/api/admin/function/',
  ]) {
    expect((await request.get(path, { headers, maxRedirects: 0 })).status(), path).toBe(401);
  }
  expect((await request.post('/api/inventory/azure/refresh/', { headers })).status()).toBe(401);
  expect(
    (await request.get('/docs/architecture.html', { headers, maxRedirects: 0 })).status(),
  ).toBe(307);
  expect(
    (
      await request.get(`/${locale}/inventario/48_functions/`, { headers, maxRedirects: 0 })
    ).status(),
  ).toBe(307);
});
