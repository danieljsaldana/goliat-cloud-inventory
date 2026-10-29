import { test, expect, signIn } from './support/fixtures.mjs';

test('Despliegue Azure cambia el diagrama, su carga y el enlace; admite teclado y móvil', async ({
  signedInPage: page,
  locale,
  t,
}, info) => {
  await page.goto(`/${locale}/architecture/`);
  const viewer = page.locator('.architecture-viewer');
  await expect(viewer).toHaveAttribute('aria-busy', 'false');
  const gate = Promise.withResolvers();
  await page.route('**/docs/azure-deployment.html?theme=light&present=1', async (route) => {
    await gate.promise;
    await route.continue();
  });
  const azure = page.getByRole('tab', { name: t('architecture.azure'), exact: true });
  try {
    await azure.click();
    await expect(azure).toHaveAttribute('aria-selected', 'true');
    await expect(viewer).toHaveAttribute('aria-busy', 'true');
    await expect(viewer.getByRole('status')).toBeVisible();
    await expect(viewer.locator('iframe')).toBeHidden();
  } finally {
    gate.resolve();
  }
  await expect(viewer).toHaveAttribute('aria-busy', 'false');
  const frame = page.frameLocator('.architecture-viewer iframe');
  for (const id of ['web', 'function', 'storage', 'postgres', 'identity', 'cost', 'resource-graph'])
    await expect(frame.locator(`#node-${id}`)).toBeVisible();
  await expect(page.locator('.architecture-snapshot')).toHaveText(t('architecture.azureSnapshot'));
  await expect(page.getByRole('link', { name: t('architecture.openDocument') })).toHaveAttribute(
    'href',
    '/docs/azure-deployment.html?theme=light',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: info.outputPath(`architecture-${info.project.name}.png`),
    fullPage: true,
  });
  await azure.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(
    page.getByRole('tab', { name: t('architecture.application'), exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(viewer).toHaveAttribute('aria-busy', 'false');
  await expect(
    page.frameLocator('.architecture-viewer iframe').locator('#node-azure-storage'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: t('architecture.openDocument') })).toHaveAttribute(
    'href',
    '/docs/architecture.html?theme=light',
  );
});

test('la arquitectura termina de cargar incluso cuando la hidratación del panel llega tarde', async ({
  signedInPage: page,
  locale,
}) => {
  const gate = Promise.withResolvers();
  await page.route('**/_next/static/**/*.js', async (route) => {
    await gate.promise;
    await route.continue();
  });
  try {
    await page.goto(`/${locale}/architecture/`, { waitUntil: 'commit' });
    await expect(page.locator('.architecture-viewer')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.architecture-loading')).toBeVisible();
  } finally {
    gate.resolve();
  }
  await expect(page.locator('.architecture-viewer')).toHaveAttribute('aria-busy', 'false');
  await expect(
    page.frameLocator('.architecture-viewer iframe').locator('#node-postgres'),
  ).toBeVisible();
  await expect(page.locator('.architecture-loading')).toHaveCount(0);
});

test('el skeleton de arquitectura reserva el espacio y desaparece al cargar el diagrama', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  const gate = Promise.withResolvers();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/docs/architecture.html?theme=light&present=1', async (route) => {
    await gate.promise;
    await route.continue();
  });
  const viewer = page.locator('.architecture-viewer');
  const loading = viewer.getByRole('status');
  const measurement = { height: null };
  try {
    await page.goto(`/${locale}/architecture/`, { waitUntil: 'domcontentloaded' });
    await expect(viewer).toHaveAttribute('aria-busy', 'true');
    await expect(loading).toContainText(t('architecture.loading'));
    await expect(loading.locator('[data-slot=skeleton]')).toHaveCount(8);
    await expect(viewer.locator('iframe')).toBeHidden();
    measurement.height = (await viewer.boundingBox()).height;
    expect(
      await loading
        .locator('[data-slot=skeleton]')
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe('none');
  } finally {
    gate.resolve();
  }
  await expect(viewer).toHaveAttribute('aria-busy', 'false');
  await expect(loading).toHaveCount(0);
  await expect(viewer.locator('iframe')).toBeVisible();
  await expect(
    page.frameLocator('.architecture-viewer iframe').locator('#node-postgres'),
  ).toBeVisible();
  expect((await viewer.boundingBox()).height).toBe(measurement.height);
});

test('la arquitectura y el documento directo requieren la misma sesión que Azure', async ({
  page,
  request,
  context,
  locale,
  t,
}) => {
  await page.goto(`/${locale}/architecture/`);
  await expect(page).toHaveURL(/\/login\//);
  expect(new URL(page.url()).searchParams.get('callbackUrl')).toBe(`/${locale}/architecture/`);
  for (const path of ['/docs/architecture.html', '/docs/azure-deployment.html']) {
    const anonymous = await request.get(path, { maxRedirects: 0 });
    expect(anonymous.status()).toBe(307);
    expect(anonymous.headers().location).toContain('/login/');
    const bot = await request.get(path, {
      headers: { 'user-agent': 'Twitterbot/1.0' },
      maxRedirects: 0,
    });
    expect(bot.status()).toBe(307);
  }
  await context.addCookies([
    { name: 'authjs.session-token', value: 'invalid-session', url: 'http://127.0.0.1:4100' },
  ]);
  for (const path of ['/docs/architecture.html', '/docs/azure-deployment.html']) {
    expect((await page.request.get(path, { maxRedirects: 0 })).status()).toBe(307);
  }
  await context.clearCookies();
  await signIn(page, locale, `/${locale}/architecture/`);
  await expect(
    page.getByRole('heading', { name: t('architecture.title'), exact: true }),
  ).toBeVisible();
  await expect(page.locator('.top-nav a[aria-current=page]')).toHaveText(t('architecture.title'));
  const document = await page.request.get('/docs/architecture.html');
  expect(document.status()).toBe(200);
  expect(document.headers()['content-type']).toContain('text/html');
  expect(document.headers()['cache-control']).toBe('private, no-store');
  expect(document.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(await document.text()).toContain('Goliat - Cloud Inventory');
  const azureDocument = await page.request.get('/docs/azure-deployment.html');
  expect(azureDocument.status()).toBe(200);
  expect(azureDocument.headers()['cache-control']).toBe('private, no-store');
  expect(azureDocument.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(await azureDocument.text()).toContain('rg-goliat-dev');
  await expect(
    page.frameLocator('.architecture-viewer iframe').locator('#node-postgres'),
  ).toBeVisible();
  await expect(
    page.frameLocator('.architecture-viewer iframe').locator('#node-azure-storage'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: t('architecture.openDocument') })).toHaveAttribute(
    'href',
    '/docs/architecture.html?theme=light',
  );
});
