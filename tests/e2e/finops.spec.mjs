import { test, expect } from './support/fixtures.mjs';
import files from '../../server/modules/azure/seed/data/inventory.json' with { type: 'json' };
import { records } from '../../src/core/table/index.js';
import { costPeriod } from '../../src/core/finops/period.js';

const resource = records(files.resources).find(({ name }) => name === 'apim-demo-prod');
const second = records(files.subscriptions).find(
  ({ subscriptionId }) => subscriptionId !== resource.subscriptionId,
);

function costs(url, status = 'ready') {
  const basis = url.searchParams.get('basis');
  const month = url.searchParams.get('month');
  const factor = basis === 'AmortizedCost' ? 0.5 : 1;
  const row = (amount, resourceId, serviceName, currency = 'EUR', day = '01') => ({
    date: `${month}-${day}`,
    amount: amount * factor,
    resourceId,
    serviceName,
    currency,
    subscriptionId: resource.subscriptionId,
  });
  return {
    status,
    basis,
    period: costPeriod(month),
    checkedAt: new Date().toISOString(),
    subscriptions: [
      { id: resource.subscriptionId, name: resource.subscriptionName, status: 'ready' },
      {
        id: second.subscriptionId,
        name: second.subscriptionName,
        status: status === 'partial' ? 'forbidden' : 'ready',
      },
    ],
    rows: [
      row(125.5429, resource.id, 'API Management'),
      row(-10, resource.id, 'API Management'),
      row(
        20,
        `/subscriptions/${resource.subscriptionId}/resourceGroups/deleted/providers/Microsoft.Compute/virtualMachines/deleted-vm`,
        'Virtual Machines',
      ),
      row(5, '', 'Reservations'),
      row(999, resource.id, 'API Management', 'USD'),
    ],
  };
}

test('FinOps filtra gastos reales y amortizados sin mezclar monedas y enlaza al inventario', async ({
  signedInPage: page,
  locale,
  t,
}, info) => {
  await page.route('**/api/finops/costs/**', (route) =>
    route.fulfill({ json: costs(new URL(route.request().url())) }),
  );
  await page.goto(`/${locale}/finops/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('finops.title'));
  await expect(page.locator('.finops-summary')).toContainText('140');
  const money = (amount) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount);
  await expect(page.locator('.finops-total strong')).toHaveText(money(140.5429));
  await expect(page.locator('.finops-resources tbody tr')).toHaveCount(3);
  await expect(
    page.locator('.finops-resources').getByRole('link', { name: resource.name, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(t('finops.outsideInventory'), { exact: true })).toBeVisible();
  await expect(
    page.locator('.finops-resources').getByText(t('finops.noResource'), { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.finops-resources')).toContainText('apim-demo-prod');
  const share = page.locator('.finops-resource-share');
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  await expect(share.getByRole('heading', { name: t('finops.resourceShare') })).toBeVisible();
  await expect(share.locator('.finops-share-detail tbody tr')).toHaveCount(3);
  await expect(share.locator('.finops-share-detail tbody tr').first()).toContainText(
    percent.format(115.5429 / 140.5429),
  );
  await expect(share.locator('.recharts-pie-sector')).toHaveCount(3);
  await page.screenshot({ path: info.outputPath('finops.png'), fullPage: true });
  await page.getByRole('combobox', { name: t('finops.groupBy'), exact: true }).click();
  await page.getByRole('option', { name: t('finops.resource'), exact: true }).click();
  await expect(page.getByRole('option', { name: t('finops.resource'), exact: true })).toBeHidden();
  const distribution = page.locator('.finops-chart').filter({ has: page.locator('.finops-bars') });
  await expect(distribution.locator('.sr-only li')).toHaveCount(3);
  await expect(distribution.locator('ul.sr-only')).toContainText(money(115.5429));
  await expect(distribution.locator('ul.sr-only')).toContainText(t('finops.noResource'));
  await expect(page.locator('.finops-bars .recharts-bar-rectangle')).toHaveCount(3);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('finops-resources.png'), fullPage: true });
  await share.screenshot({ path: info.outputPath('finops-pie.png') });
  const sector = share.locator('.recharts-pie-sector path').first();
  const bounds = await sector.boundingBox();
  await sector.hover({
    position: { x: bounds.width * 0.8, y: bounds.height * 0.5 },
    timeout: 10000,
  });
  await expect(share.locator('[data-slot="chart-tooltip"]')).toContainText(resource.name);
  await expect(share.locator('[data-slot="chart-tooltip"]')).not.toContainText('/subscriptions/');
  await expect(share.locator('[data-slot="chart-tooltip"]')).toContainText(
    percent.format(115.5429 / 140.5429),
  );
  await share
    .locator('.finops-share-figure')
    .screenshot({ path: info.outputPath('finops-pie-tooltip.png') });
  await page.locator('.finops-bars .recharts-bar-rectangle').first().hover();
  await expect(distribution.locator('[data-slot="chart-tooltip"]')).toContainText(resource.id);
  await expect(distribution.locator('[data-slot="chart-tooltip"]')).toContainText(money(115.5429));
  await page.getByRole('combobox', { name: t('finops.currency'), exact: true }).click();
  await page.getByRole('option', { name: 'USD', exact: true }).click();
  await expect(page.locator('.finops-total strong')).toContainText('999');
  await expect(page.locator('.finops-resources tbody tr')).toHaveCount(1);
  await expect(share.locator('.finops-share-detail tbody tr')).toHaveCount(1);
  await expect(share.locator('.finops-share-detail')).toContainText(percent.format(1));
  await page.getByRole('combobox', { name: t('finops.currency'), exact: true }).click();
  await page.getByRole('option', { name: 'EUR', exact: true }).click();
  const basis = page.getByRole('combobox', { name: t('finops.basis'), exact: true });
  await basis.click();
  await page.getByRole('option', { name: t('finops.amortized'), exact: true }).click();
  await expect(basis).toBeFocused();
  await expect(page.locator('.finops-total strong')).toContainText('70');
  await expect(page.locator('.finops-total strong')).toHaveText(money(70.27145));
  const search = page.getByRole('searchbox', { name: t('finops.search') });
  await search.fill('deleted-vm');
  await expect(search).toHaveValue('deleted-vm');
  await expect(page.locator('.finops-resources tbody tr')).toHaveCount(1);
  await search.fill('');
  await expect(search).toHaveValue('');
  await expect(page.locator('.finops-resources tbody tr')).toHaveCount(3);
  await page
    .locator('.finops-resources')
    .getByRole('link', { name: resource.name, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/inventario/resources/\\?q=`));
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(1);
  await expect(page.locator('.table-panel tbody tr')).toContainText(resource.name);
});

test('El tooltip de la tarta contiene nombres sin espacios e importes largos en escritorio y móvil', async ({
  signedInPage: page,
  locale,
  t,
}, info) => {
  const name = 'aprendejapones_osdisk_1_e86b396d108d4a9495ad0ed62d19e5b1';
  const amount = 1234567890123.4567;
  await page.route('**/api/finops/costs/**', (route) => {
    const data = costs(new URL(route.request().url()));
    return route.fulfill({
      json: {
        ...data,
        rows: [
          { ...data.rows[0], resourceId: resource.id.replace(/[^/]+$/, name), amount },
          { ...data.rows[0], amount: amount / 9 },
        ],
      },
    });
  });
  if (info.project.name === 'en-mobile') await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/${locale}/finops/`);
  const chart = page.locator('.finops-resource-share .finops-pie');
  await expect(chart.locator('.recharts-pie-sector')).toHaveCount(2);
  const sector = chart.locator('.recharts-pie-sector path').first();
  const bounds = await sector.boundingBox();
  await sector.hover({ position: { x: bounds.width * 0.8, y: bounds.height * 0.5 } });
  const tooltip = chart.locator('[data-slot="chart-tooltip"]');
  await expect(tooltip).toBeVisible();
  await expect
    .poll(() =>
      tooltip.getByText(t('finops.spend'), { exact: true }).evaluate((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getClientRects().length;
      }),
    )
    .toBe(1);
  await expect(tooltip).toContainText(name);
  await expect(tooltip).toContainText(
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount),
  );
  await expect(tooltip).toContainText(
    new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(0.9),
  );
  await expect
    .poll(() =>
      tooltip.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const text = [];
        while (walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          text.push(...range.getClientRects());
        }
        return (
          node.scrollWidth <= node.clientWidth + 1 &&
          box.left >= 0 &&
          box.right <= innerWidth + 1 &&
          text.every(
            (rect) =>
              rect.left >= box.left - 1 &&
              rect.right <= box.right + 1 &&
              rect.top >= box.top - 1 &&
              rect.bottom <= box.bottom + 1,
          )
        );
      }),
    )
    .toBe(true);
  await chart.screenshot({ path: info.outputPath('finops-long-tooltip.png') });
});

test('La tarta conserva porcentajes globales al paginar y separa saldos negativos y cero', async ({
  signedInPage: page,
  locale,
  t,
}, info) => {
  const state = { onlyCredits: false };
  await page.route('**/api/finops/costs/**', (route) => {
    const data = costs(new URL(route.request().url()));
    const row = (amount, suffix) => ({
      ...data.rows[0],
      amount,
      resourceId: resource.id + suffix,
    });
    const rows = [60.5429, 20, 10, 5, 3, 2, 1, 0.02].map((amount, index) =>
      row(amount, '-' + index),
    );
    const credits = [row(-4, '-credit'), row(0, '-zero')];
    return route.fulfill({
      json: {
        ...data,
        rows: state.onlyCredits
          ? credits
          : [
              ...rows,
              {
                ...rows[0],
                amount: -10,
                resourceId: rows[0].resourceId.toUpperCase(),
                serviceName: 'Storage',
              },
              ...credits,
            ],
      },
    });
  });
  const money = (amount) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount);
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  await page.goto(`/${locale}/finops/`);
  const share = page.locator('.finops-resource-share');
  await expect(share.locator('.recharts-pie-sector')).toHaveCount(6);
  await expect(share.locator('.finops-share-legend')).toContainText(
    t('finops.otherResources', { count: '3' }),
  );
  await expect(share).toContainText(t('finops.shareBasis', { total: money(91.5629) }));
  await expect(share).toContainText(t('finops.shareCredits', { amount: money(-4) }));
  await expect(share.locator('tbody tr').first()).toContainText(percent.format(50.5429 / 91.5629));
  await page.evaluate(() => window.scrollTo(0, 0));
  await share.screenshot({ path: info.outputPath('finops-pie-many.png') });
  await share.getByRole('button', { name: t('table.nextPage'), exact: true }).click();
  await expect(share.locator('tbody tr').first()).toContainText(percent.format(2 / 91.5629));
  await expect(share.locator('tbody')).toContainText(
    t('finops.smallShare', { percent: percent.format(0.001) }),
  );
  await expect(
    share.locator('tbody tr').filter({ hasText: 'apim-demo-prod-credit' }),
  ).toContainText('—');
  await expect(share.locator('.recharts-pie-sector')).toHaveCount(6);
  state.onlyCredits = true;
  await page.getByRole('button', { name: t('finops.refresh'), exact: true }).click();
  await expect(
    share.getByRole('status').filter({ hasText: t('finops.noPositiveCosts') }),
  ).toBeVisible();
  await expect(share.locator('.finops-pie')).toHaveCount(0);
  await expect(share.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.finops-total strong')).toHaveText(money(-4));
});

test('FinOps conserva gastos parciales y distingue una suscripción sin permiso de gasto cero', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  await page.route('**/api/finops/costs/**', (route) =>
    route.fulfill({ json: costs(new URL(route.request().url()), 'partial') }),
  );
  await page.goto(`/${locale}/finops/`);
  await expect(page.getByText(t('finops.partialTotal'), { exact: true })).toBeVisible();
  await expect(page.locator('main').getByRole('alert')).toContainText(t('finops.status.forbidden'));
  await page.getByRole('combobox', { name: t('subscriptions.label'), exact: true }).click();
  await page.getByRole('option', { name: second.subscriptionName, exact: true }).click();
  await expect(page.locator('.finops-summary')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: t('finops.unavailable') })).toBeVisible();
});

test('FinOps muestra ausencia de configuración y permite reintentar un error sin inventar importes', async ({
  signedInPage: page,
  locale,
  t,
}) => {
  const state = { failed: true };
  await page.route('**/api/finops/costs/**', (route) => {
    if (state.failed) return route.fulfill({ status: 503, json: { error: 'costs_unavailable' } });
    return route.fulfill({
      json: {
        ...costs(new URL(route.request().url())),
        status: 'not-configured',
        rows: [],
        subscriptions: [],
      },
    });
  });
  await page.goto(`/${locale}/finops/`);
  await expect(page.locator('main').getByRole('alert')).toContainText(t('finops.error'));
  await expect(page.locator('.finops-summary')).toHaveCount(0);
  state.failed = false;
  await page.getByRole('button', { name: t('finops.refresh'), exact: true }).click();
  await expect(page.getByRole('heading', { name: t('finops.notConfigured') })).toBeVisible();
  await expect(page.locator('.finops-summary')).toHaveCount(0);
});

test('FinOps exige sesión en páginas y API de costes', async ({ page, request, locale }) => {
  await page.goto(`/${locale}/finops/`);
  await expect(page).toHaveURL(/\/login\//);
  const response = await request.get('/api/finops/costs/');
  expect(response.status()).toBe(401);
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('SAMEORIGIN');
  for (const headers of [
    { 'user-agent': 'Twitterbot/1.0' },
    {
      'x-middleware-subrequest': 'proxy:proxy:proxy:proxy:proxy',
      cookie: 'authjs.session-token=forged',
    },
    { authorization: 'Bearer forged', origin: 'https://evil.example' },
  ]) {
    const denied = await request.get('/api/finops/costs/', { headers, maxRedirects: 0 });
    expect(denied.status()).toBe(401);
    expect(denied.headers()['cache-control']).toContain('no-store');
    expect(await denied.text()).not.toContain('subscriptions');
  }
});
