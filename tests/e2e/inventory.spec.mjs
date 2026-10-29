import { test, expect } from './support/fixtures.mjs';
import files from '../../server/modules/azure/seed/data/inventory.json' with { type: 'json' };
import { REPORTS } from '../../src/core/inventory/reports.js';
import { SERVICES } from '../../src/features/inventory/components/overview/ServiceSummary/constants.js';

test('Inventario tiene navegación propia y la portada enlaza a su URL canónica', async ({
  signedInPage: page,
  locale,
  t,
}, info) => {
  const path = `/${locale}/inventario/`;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('inventory.title'));
  await expect(page.locator(`.top-nav a[href='${path}']`)).toHaveAttribute('aria-current', 'page');
  await expect(page.locator(`.dashboard-breadcrumb a[href='${path}']`)).toHaveText(
    t('inventory.title'),
  );
  await expect(page.locator('a[href*="/azure/"]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('inventario.png'), fullPage: true });
  await page.locator('.site-header > .brand').click();
  const inventory = page.locator('.provider-card');
  await expect(inventory).toHaveAttribute('href', path);
  await expect(inventory).toHaveAccessibleName(t('home.exploreInventory'));
  await inventory.click();
  await expect(page).toHaveURL((url) => url.pathname === path);
});

test('el menú agrupa el catálogo y encuentra servicios sin desplegar todos los grupos', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  const mobile = page.getByRole('button', { name: t('nav.openMenu'), exact: true });
  const navigation = { container: page.locator('.sidebar') };
  if (await mobile.isVisible()) {
    await mobile.click();
    navigation.container = page.getByRole('dialog');
  }
  await expect(navigation.container.locator('.side-group')).toHaveCount(12);
  const search = navigation.container.getByRole('searchbox', { name: t('nav.searchServices') });
  await search.fill('postgres');
  await expect(navigation.container.locator('.side-group')).toHaveCount(1);
  await expect(
    navigation.container.locator(`a[href='/${locale}/inventario/postgresql/']`),
  ).toBeVisible();
  await search.fill('not-a-real-service');
  await expect(
    navigation.container.getByText(t('nav.noMatchingServices'), { exact: true }),
  ).toBeVisible();
  await search.fill('functions');
  await navigation.container.locator(`a[href='/${locale}/inventario/functions/']`).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/inventario/functions/$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('reports.functions'));
});

test('las URLs y endpoints numerados se han eliminado', async ({ signedInPage: page, locale }) => {
  for (const path of [
    `/${locale}/inventario/48_functions/`,
    '/api/inventory/azure/48_functions/',
  ]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(path.startsWith('/api/') ? 400 : 404);
    expect(response.headers().location).toBeUndefined();
  }
});

test('las antiguas URLs de Azure devuelven 404 sin redirección', async ({
  signedInPage: page,
  locale,
}) => {
  for (const path of [`/${locale}/azure/`, `/${locale}/azure/resources/`]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
  }
});

test('todas las vistas del catálogo renderizan su tabla o su estado vacío en ambos idiomas', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  test.setTimeout(120000);
  for (const report of REPORTS) {
    await page.goto(`/${locale}/inventario/${report.id}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t(report.labelKey));
    const count = files[report.id].rows.length;
    if (count > 0) {
      await expect(page.locator('.table-panel tbody tr'), report.id).toHaveCount(
        Math.min(100, count),
      );
      await expect(page.locator('.table-panel caption')).toHaveText(t(report.labelKey));
    } else {
      await expect(
        page.getByText(t('table.noResources'), { exact: true }),
        report.id,
      ).toBeVisible();
    }
    await expect(page.locator('.load-warning')).toHaveCount(0);
  }
});

test('la cuadrícula de servicios pagina todos los enlaces y el menú abre la vista seleccionada', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  const services = page.locator('.service-panel');
  const links = services.locator('.service-grid a');
  await expect(links.first()).toBeVisible();
  const visited = [];
  const next = services.getByRole('button', { name: t('table.nextPage'), exact: true });
  for (const index of SERVICES.keys()) {
    await expect(services.locator('[aria-current=page]')).toHaveText(String(index + 1));
    const current = await links.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('href')),
    );
    visited.push(...current);
    if (await next.isDisabled()) break;
    const first = current[0];
    await next.click();
    await expect(links.first()).not.toHaveAttribute('href', first);
  }
  expect(visited).toHaveLength(SERVICES.length);
  expect(new Set(visited).size).toBe(SERVICES.length);
  const report = REPORTS.find(({ id }) => id === 'resources');
  const mobile = page.getByRole('button', { name: t('nav.openMenu'), exact: true });
  const navigation = { container: page.locator('.sidebar') };
  if (await mobile.isVisible()) {
    await mobile.click();
    navigation.container = page.getByRole('dialog');
  }
  await navigation.container.locator(`a[href='/${locale}/inventario/${report.id}/']`).click();
  await expect(page).toHaveURL(new RegExp(`/inventario/${report.id}/`));
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(100);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('la suscripción filtra todas las vistas y conserva la selección al recargar', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  const scope = page.getByRole('combobox', { name: t('subscriptions.label') });
  await scope.click();
  await page.getByRole('option', { name: 'Demo - Desarrollo', exact: true }).click();
  await expect(page.locator('.kpi strong').first()).toHaveText('63');
  await page.goto(`/${locale}/inventario/resources/`);
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(63);
  for (const row of await page.locator('.table-panel tbody tr').allTextContents())
    expect(row).toContain('Demo - Desarrollo');
  await page.reload();
  await expect(scope).toContainText('Demo - Desarrollo');
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(63);
  await scope.click();
  await page.getByRole('option', { name: t('subscriptions.all'), exact: true }).click();
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(100);
});

test('buscar, filtrar columnas, agrupar y ordenar actualiza la tabla y reinicia la paginación', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  await page.goto(`/${locale}/inventario/resources/`);
  const rows = page.locator('.table-panel tbody tr');
  await expect(rows).toHaveCount(100);
  await page
    .locator('.table-footer')
    .getByRole('button', { name: t('table.nextPage'), exact: true })
    .click();
  await expect(page.locator('.table-footer [aria-current=page]')).toHaveText('2');
  await page.getByRole('searchbox', { name: t('table.searchLabel') }).fill('apim-demo-prod');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('apim-demo-prod');
  await expect(page.locator('.table-footer [aria-current=page]')).toHaveText('1');
  await page.getByRole('button', { name: t('table.clearFilters'), exact: true }).click();
  await page.getByRole('button', { name: t('table.filters'), exact: true }).click();
  await page
    .getByRole('textbox', {
      name: t('table.filterColumn', { column: t('table.columns.resourceGroup') }),
      exact: true,
    })
    .fill('rg-demo-dev');
  await expect(rows).toHaveCount(63);
  await page.getByRole('combobox', { name: t('table.groupLabel') }).click();
  await page.getByRole('option', { name: t('table.columns.location'), exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('northeurope');
  await expect(rows.first()).toContainText('63');
  await expect(page.locator('.table-toolbar-actions button').last()).toBeDisabled();
  await page.getByRole('button', { name: t('table.clearFilters'), exact: true }).click();
  await page.goto(`/${locale}/inventario/resource-types/`);
  const column = page.getByRole('columnheader', {
    name: t('table.columns.resources'),
    exact: true,
  });
  await column.getByRole('button').click();
  await expect(column).toHaveAttribute('aria-sort', 'ascending');
  await column.getByRole('button').click();
  await expect(column).toHaveAttribute('aria-sort', 'descending');
  const values = await page.locator('.table-panel tbody tr td:last-child').allTextContents();
  expect(values.map(Number)).toEqual(values.map(Number).sort((a, b) => b - a));
});

test('cambiar el tamaño de página y buscar sin resultados conserva controles coherentes', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  await page.goto(`/${locale}/inventario/resources/`);
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(100);
  await page
    .locator('.table-footer')
    .getByRole('button', { name: t('table.nextPage'), exact: true })
    .click();
  await page.getByRole('combobox', { name: t('table.pageSize') }).click();
  await page.getByRole('option', { name: '50', exact: true }).click();
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(50);
  await expect(page.locator('.table-footer [aria-current=page]')).toHaveText('1');
  await page
    .getByRole('searchbox', { name: t('table.searchLabel') })
    .fill('no-existe-en-la-semilla');
  await expect(page.getByText(t('table.noResults'), { exact: true })).toBeVisible();
  await expect(page.locator('.table-footer [aria-current=page]')).toHaveCount(0);
  await expect(
    page.locator('.table-footer').getByRole('button', { name: t('table.nextPage'), exact: true }),
  ).toBeDisabled();
  await page
    .locator('.table-toolbar')
    .getByRole('button', { name: t('table.clearFilters'), exact: true })
    .click();
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(50);
});

test('una suscripción vacía muestra un estado con borde y no habilita páginas inexistentes', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  await page.getByRole('combobox', { name: t('subscriptions.label') }).click();
  await page.getByRole('option', { name: 'Demo - Vacía', exact: true }).click();
  await expect(page.locator('.kpi strong').first()).toHaveText('0');
  await page.goto(`/${locale}/inventario/resources/`);
  await expect(page.getByText(t('table.noResources'), { exact: true })).toBeVisible();
  expect(
    await page
      .locator('.table-panel')
      .evaluate((element) => getComputedStyle(element).borderTopWidth),
  ).toBe('1px');
  await expect(page.locator('.table-footer [aria-current=page]')).toHaveCount(0);
  await expect(
    page.locator('.table-footer').getByRole('button', { name: t('table.nextPage'), exact: true }),
  ).toBeDisabled();
});

test('las gráficas muestran etiquetas completas y el tooltip conserva el nombre abreviado', async ({
  signedInPage: page,
  t,
}) => {
  const chart = page
    .locator('.chart-card')
    .filter({ has: page.getByText(t('overview.resourceTypes'), { exact: true }) });
  await expect(chart.locator('[data-bar-axis-label]').first()).toBeVisible();
  for (const label of await page.locator('[data-bar-axis-label]').allTextContents()) {
    expect(label).not.toMatch(/microsoft\.|\/|\.\.\./i);
  }
  const labels = chart.locator('[data-bar-axis-label]');
  for (const label of await labels.all()) {
    const fits = await label.evaluate((element) => {
      const text = element.getBoundingClientRect();
      const box = element.closest('foreignObject').getBoundingClientRect();
      return (
        text.top >= box.top - 1 &&
        text.bottom <= box.bottom + 1 &&
        element.scrollWidth <= box.width + 1
      );
    });
    expect(fits, await label.textContent()).toBe(true);
  }
  const name = await labels.first().textContent();
  await chart.locator('.recharts-bar-rectangle').first().hover();
  await expect(chart.locator('.recharts-tooltip-wrapper')).toContainText(name);
});

test('distingue carga, error de consulta e inventario vacío', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  const gate = Promise.withResolvers();
  await page.route(
    (url) => url.pathname === '/api/inventory/azure/',
    async (route) => {
      await gate.promise;
      await route.fulfill({ status: 503, json: { error: 'inventory_unavailable' } });
    },
  );
  await page.goto(`/${locale}/inventario/`);
  try {
    await expect(page.locator('.loading-state')).toBeVisible();
    await expect(page.locator('.loading-state')).toHaveAttribute('role', 'status');
    expect(await page.locator('.loading-state [data-slot=skeleton]').count()).toBeGreaterThan(10);
    await expect(page.locator('.loading-state [role=progressbar]')).toHaveCount(0);
  } finally {
    gate.resolve();
  }
  await expect(page.locator('.load-warning')).toBeVisible();
  await page.unrouteAll({ behavior: 'wait' });
  await page.route(
    (url) => url.pathname === '/api/inventory/azure/',
    async (route) => {
      await route.fulfill({ json: { files: {}, metadata: null, errors: [] } });
    },
  );
  await page.reload();
  await expect(page.getByText(t('dashboard.noInventory'), { exact: true })).toBeVisible();
  await expect(page.locator('.load-warning')).toHaveCount(0);
});
