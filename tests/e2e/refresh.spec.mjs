import { test, expect } from './support/fixtures.mjs';
import { E2E_ORIGIN } from './support/constants.mjs';

for (const provider of ['azure']) {
  const endpoint = '/api/inventory/azure/refresh/';
  const dataPath = '/api/inventory/azure/';
  const container = '.page-heading';

  test.beforeEach(async ({ page }, info) => {
    if (info.title.includes('sin API configurada')) return;
    await page.route(
      (url) => url.pathname === endpoint,
      async (route) => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { running: false } });
        return route.fallback();
      },
    );
  });

  test(`${provider}: espera la importación, evita dobles clics y confirma los datos antes del toast de éxito`, async ({
    signedInPage: page,
    locale,
    t,
  }) => {
    await page.goto(`/${locale}/inventario/`);
    const button = page
      .locator(container)
      .getByRole('button', { name: t('common.refresh'), exact: true });
    await expect(button).toBeEnabled();
    const gate = Promise.withResolvers();
    const calls = { post: 0, reads: 0 };
    const operationId = '11111111-1111-4111-8111-111111111111';
    await page.route(
      (url) => url.pathname === dataPath,
      async (route) => {
        calls.reads += 1;
        await route.continue();
      },
    );
    await page.route(
      (url) => url.pathname === endpoint,
      async (route) => {
        if (route.request().method() === 'GET')
          return route.fulfill({ json: { running: false, status: 'succeeded', operationId } });
        calls.post += 1;
        await gate.promise;
        if (new URL(route.request().url()).searchParams.has('operationId'))
          return route.fulfill({ json: { imported: true } });
        return route.fulfill({ status: 202, json: { operationId, status: 'queued' } });
      },
    );
    try {
      await button.click();
      await expect(button).toBeDisabled();
      await expect(page.locator('[data-sonner-toast][data-type=loading]')).toContainText(
        t('notifications.refreshing'),
      );
      await expect(page.locator('[data-sonner-toast] .lucide-refresh-cw')).toBeVisible();
      await button.dispatchEvent('click');
      expect(calls.post).toBe(1);
      expect(calls.reads).toBe(0);
    } finally {
      gate.resolve();
    }
    await expect(page.locator('[data-sonner-toast][data-type=success]')).toContainText(
      t('notifications.refreshed'),
    );
    await expect(page.locator('[data-sonner-toast] .lucide-circle-check')).toBeVisible();
    await expect(button).toBeEnabled();
    expect(calls.reads).toBe(1);
    expect(calls.post).toBe(2);
  });

  test(`${provider}: un fallo de actualización conserva los datos y permite reintentar`, async ({
    signedInPage: page,
    locale,
    t,
  }) => {
    await page.goto(`/${locale}/inventario/`);
    const button = page
      .locator(container)
      .getByRole('button', { name: t('common.refresh'), exact: true });
    await expect(button).toBeEnabled();
    const data = page.locator('.kpi-grid');
    const before = await data.textContent();
    await page.route(
      (url) => url.pathname === endpoint,
      async (route) => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { running: false } });
        return route.fulfill({ status: 503, json: { error: 'refresh_unavailable' } });
      },
    );
    await button.click();
    await expect(page.locator('[data-sonner-toast][data-type=error]')).toContainText(
      t('notifications.refreshFailed'),
    );
    await expect(page.locator('[data-sonner-toast] .lucide-circle-x')).toBeVisible();
    await expect(data).toBeVisible();
    expect(await data.textContent()).toBe(before);
    await expect(button).toBeEnabled();
  });

  test(`${provider}: sin API configurada bloquea el botón y rechaza generar`, async ({
    signedInPage: page,
    locale,
    t,
  }) => {
    await page.goto(`/${locale}/inventario/`);
    const button = page.locator(container).getByRole('button');
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('title', t('notifications.refreshStatusUnavailable'));
    const response = await page.request.post(endpoint, { headers: { Origin: E2E_ORIGIN } });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ error: 'refresh_unconfigured' });
  });

  test(`${provider}: una carrera devuelve un aviso de ocupación y un estado desconocido bloquea el botón`, async ({
    signedInPage: page,
    locale,
    t,
  }) => {
    await page.goto(`/${locale}/inventario/`);
    const button = page.locator(container).getByRole('button');
    await expect(button).toBeEnabled();
    const state = { running: false, unavailable: false };
    await page.route(
      (url) => url.pathname === endpoint,
      async (route) => {
        if (route.request().method() === 'POST') {
          state.running = true;
          return route.fulfill({ status: 409, json: { error: 'refresh_busy' } });
        }
        if (state.unavailable)
          return route.fulfill({ status: 503, json: { error: 'refresh_status_unavailable' } });
        return route.fulfill({ json: { running: state.running } });
      },
    );
    await button.click();
    await expect(page.locator('[data-sonner-toast][data-type=info]')).toContainText(
      t('notifications.refreshBusy'),
    );
    await expect(button).toBeDisabled();
    state.running = false;
    await expect(button).toBeEnabled({ timeout: 12000 });
    state.unavailable = true;
    await expect(button).toBeDisabled({ timeout: 12000 });
    await expect(button).toHaveAttribute('title', t('notifications.refreshStatusUnavailable'));
    state.unavailable = false;
    await expect(button).toBeEnabled({ timeout: 12000 });
  });
}
