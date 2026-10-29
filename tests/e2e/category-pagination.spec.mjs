import { test, expect } from './support/fixtures.mjs';

function inventory(count) {
  const headers = [
    'id',
    'name',
    'type',
    'subscriptionId',
    'subscriptionName',
    'resourceGroup',
    'location',
    'tags_json',
  ];
  return {
    files: {
      resources: {
        headers,
        rows: Array.from({ length: count }, (_, index) => [
          `/subscriptions/sub-${index % 23}/resourceGroups/grupo-${index % 107}/providers/Microsoft.Compute/virtualMachines/vm-${index}`,
          `vm-${index}`,
          'microsoft.compute/virtualmachines',
          `sub-${index % 23}`,
          `Suscripción ${index % 23}`,
          `grupo-${index % 107}`,
          'westeurope',
          JSON.stringify({ environment: `entorno-${index % 101}` }),
        ]),
      },
      subscriptions: {
        headers: ['subscriptionId', 'subscriptionName', 'state'],
        rows: Array.from({ length: Math.min(count, 23) }, (_, index) => [
          `sub-${index}`,
          `Suscripción ${index}`,
          'Enabled',
        ]),
      },
    },
    metadata: null,
    errors: [],
  };
}

test('las listas y gráficas grandes muestran rangos, limitan elementos y permiten buscar fuera de la página', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  await page.route(
    (url) => url.pathname === '/api/inventory/azure/',
    (route) => route.fulfill({ json: inventory(1003) }),
  );
  await page.goto(`/${locale}/inventario/tags-overview/`);
  await expect(page.locator('.kpi strong').first()).toHaveText(/1[.,]?003/);
  for (const chart of await page.locator('.chart-card').all()) {
    await expect(chart.locator('[data-bar-axis-label]')).toHaveCount(5);
    await expect(chart.locator('.pagination-status')).toContainText('1–5');
  }
  await expect(page.locator('.subscription-list button')).toHaveCount(5);
  await expect(page.locator('.subscription-panel .pagination-status')).toHaveText(
    '1–5 ' + (locale === 'es' ? 'de' : 'of') + ' 23',
  );
  const groups = page.locator('.overview-bottom .chart-card');
  await groups
    .getByRole('combobox', {
      name: t('category.exploreChart', { chart: t('category.byResourceGroup') }),
    })
    .click();
  const popup = page.locator('.paginated-select-content');
  await expect(popup.getByRole('option')).toHaveCount(20);
  await popup.getByRole('button', { name: t('table.nextPage'), exact: true }).press('Enter');
  await expect(popup.locator('.pagination-status')).toContainText('21–40');
  await expect(popup).toBeVisible();
  await popup.getByRole('combobox', { name: t('select.search'), exact: true }).fill('grupo-106');
  await expect(popup.getByRole('option')).toHaveCount(9);
  await expect(popup.locator('.pagination-status')).toContainText('1–9');
  await popup.getByRole('combobox', { name: t('select.search'), exact: true }).press('Enter');
  await expect(popup).toHaveCount(0);
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(1);
  await expect(
    groups.getByRole('combobox', {
      name: t('category.exploreChart', { chart: t('category.byResourceGroup') }),
    }),
  ).toContainText('grupo-106');
  await page.getByRole('button', { name: t('table.clearFilters'), exact: true }).click();
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(100);
  const subscription = page.getByRole('combobox', { name: t('subscriptions.label'), exact: true });
  await subscription.click();
  await popup.getByRole('combobox', { name: t('select.search'), exact: true }).fill('sub-22');
  await popup.getByRole('combobox', { name: t('select.search'), exact: true }).press('Enter');
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(43);
  await subscription.click();
  await popup
    .getByRole('combobox', { name: t('select.search'), exact: true })
    .fill(t('subscriptions.all'));
  await popup.getByRole('combobox', { name: t('select.search'), exact: true }).press('Enter');
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
});

test('el contador y la paginación también aparecen con un solo elemento', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  await page.route(
    (url) => url.pathname === '/api/inventory/azure/',
    (route) => route.fulfill({ json: inventory(1) }),
  );
  await page.goto(`/${locale}/inventario/tags-overview/`);
  await expect(page.locator('.kpi strong').first()).toHaveText('1');
  for (const panel of await page.locator('.chart-card, .subscription-panel').all()) {
    await expect(panel.locator('.pagination-status')).toContainText('1–1');
    await expect(
      panel.getByRole('button', { name: t('table.nextPage'), exact: true }),
    ).toBeDisabled();
  }
  await expect(page.locator('.category-reports .pagination-status')).toBeVisible();
});

test('el selector se cierra si su ancla sale de la pantalla al terminar la carga y se puede volver a abrir', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  const gate = Promise.withResolvers();
  await page.route(
    (url) => url.pathname === '/api/inventory/azure/',
    async (route) => {
      await gate.promise;
      await route.fulfill({ json: inventory(1003) });
    },
  );
  await page.goto(`/${locale}/inventario/tags-overview/`);
  try {
    await expect(page.locator('.inventory-loading')).toBeVisible();
    await page
      .locator('footer')
      .getByRole('combobox', { name: t('language.label') })
      .click();
  } finally {
    gate.resolve();
  }
  await expect(page.locator('.kpi strong').first()).toHaveText(/1[.,]?003/);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page
    .locator('footer')
    .getByRole('combobox', { name: t('language.label') })
    .click();
  const option = page.getByRole('option', {
    name: locale === 'es' ? 'English' : 'Español',
    exact: true,
  });
  await expect
    .poll(async () =>
      option.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight;
      }),
    )
    .toBe(true);
  await option.click();
  await expect(page).toHaveURL(
    new RegExp(`/${locale === 'es' ? 'en' : 'es'}/inventario/tags-overview/$`),
  );
});
