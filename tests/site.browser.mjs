import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import seed from '../server/modules/azure/seed/data/inventory.json' with { type: 'json' };
import { records } from '../src/core/table/index.js';
import { getCategoryOverview, resourceTags } from '../src/core/inventory/categories.js';
import { getOverviewData } from '../src/core/inventory/overview.js';
import { METRIC_PERIODS } from '../src/features/administration/metricPeriods.js';
import { validateSchedule } from '../server/administration/schedule.mjs';

const state = {};
const prefix = '/goliat-cloud-inventory/';
const contentTypes = {
  js: 'text/javascript',
  json: 'application/json',
  css: 'text/css',
  html: 'text/html',
  svg: 'image/svg+xml',
  png: 'image/png',
  woff2: 'font/woff2',
  txt: 'text/plain',
};

before(async () => {
  const files = new Map([
    [
      prefix,
      { body: await readFile(new URL('../site/index.html', import.meta.url)), type: 'text/html' },
    ],
  ]);
  for (const name of ['demo.js', 'demo.css', 'demo-dom.js', 'admin-demo.js', 'admin-demo.css']) {
    files.set(`${prefix}${name}`, {
      body: await readFile(new URL(`../site/${name}`, import.meta.url)),
      type: contentTypes[name.split('.').at(-1)],
    });
  }
  const assets = fileURLToPath(new URL('../site/assets/', import.meta.url));
  for (const entry of await readdir(assets, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    const name = relative(assets, path).split(sep).join('/');
    files.set(`${prefix}assets/${name}`, {
      body: await readFile(path),
      type: contentTypes[name.split('.').at(-1)] || 'application/octet-stream',
    });
  }
  state.server = createServer((request, response) => {
    const file = files.get(new URL(request.url, 'http://localhost').pathname);
    response.writeHead(file ? 200 : 404, { 'Content-Type': file?.type || 'text/plain' });
    response.end(file?.body || 'Not found');
  });
  await new Promise((resolve, reject) => {
    state.server.once('error', reject);
    state.server.listen(0, '127.0.0.1', resolve);
  });
  state.url = `http://127.0.0.1:${state.server.address().port}${prefix}`;
  state.browser = await chromium.launch();
});

after(async () => {
  await state.browser?.close();
  if (state.server?.listening) {
    await new Promise((resolve, reject) => {
      state.server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('los datos publicados proceden exclusivamente de la semilla del repositorio', async () => {
  const data = JSON.parse(
    await readFile(new URL('../site/assets/demo-data.json', import.meta.url), 'utf8'),
  );
  assert.equal(data.source, 'repository-demo-seed');
  assert.equal(data.resources.length, 214);
  assert.equal(data.subscriptions.length, 5);
  assert.equal(data.management.source, 'synthetic-management-example');
  assert.equal(data.management.members.length, 6);
  assert.ok(
    data.management.members.every(
      (member) =>
        member.name.startsWith('Demo ') &&
        member.email.endsWith('@demo.example') &&
        member.objectId.startsWith('00000000-0000-4000-8000-'),
    ),
  );
  assert.deepEqual(
    data.resources.map(({ id }) => id),
    records(seed.resources).map(({ id }) => id),
  );
  for (const category of data.categories) {
    assert.deepEqual(
      category.resourceIds,
      getCategoryOverview(seed, category.id).rows.map(({ id }) => id),
    );
  }
  assert.equal(
    data.resources.every(
      ({ demoCostCents }) => Number.isInteger(demoCostCents) && demoCostCents > 0,
    ),
    true,
  );
});

for (const [locale, width] of [
  ['en', 1440],
  ['es', 390],
]) {
  test(`el menú, la búsqueda y la paginación usan datos reales de prueba en ${locale} a ${width}px`, async () => {
    const page = await state.browser.newPage({ viewport: { width, height: 1000 }, locale });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const panel = page.locator('#inventory-panel');
    async function choose(view) {
      const link = page.locator(`[data-view="${view}"]`);
      if (await link.isVisible()) await link.click();
      else await panel.locator('[data-control="view"]').selectOption(view);
    }
    try {
      await page.goto(state.url);
      await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
      const overview = getOverviewData(seed);
      await expect(panel.locator('[data-metric="resources"] strong')).toHaveText(
        String(overview.total),
      );
      await expect(panel.locator('[data-metric="providers"] strong')).toHaveText(
        String(overview.providerCount),
      );
      await expect(panel.locator('[data-metric="subscriptions"] strong')).toHaveText(
        String(overview.activeSubscriptions),
      );
      await expect(panel.locator('[data-metric="coverage"] strong')).toHaveText(
        `${overview.coveragePercent}%`,
      );
      for (const group of [
        'compute',
        'containers',
        'web',
        'network',
        'databases',
        'security',
        'tags',
      ]) {
        await choose(group);
        const rows = getCategoryOverview(seed, group).rows;
        await expect(panel.locator('[data-metric="resources"] strong')).toHaveText(
          String(rows.length),
        );
        assert.deepEqual(
          await panel.locator('tbody .demo-resource-name').allTextContents(),
          rows.slice(0, 5).map(({ name }) => name),
        );
      }
      await choose('resources');
      await panel.locator('[data-control="page-size"]').selectOption('20');
      const visited = [];
      for (const index of Array.from({ length: Math.ceil(214 / 20) }, (_, index) => index)) {
        await expect(panel.locator('.demo-page')).toContainText(`${index + 1} / 11`);
        visited.push(...(await panel.locator('tbody .demo-resource-name').allTextContents()));
        if (await panel.locator('[data-page="next"]').isEnabled())
          await panel.locator('[data-page="next"]').click();
      }
      assert.deepEqual(
        visited,
        records(seed.resources).map(({ name }) => name),
      );
      await expect(panel.locator('[data-page="next"]')).toBeDisabled();
      const resource = records(seed.resources)[0];
      await panel.locator('[data-control="search"]').fill(resource.name);
      await expect(panel.locator('tbody tr')).toHaveCount(1);
      await expect(panel.locator('[data-page="previous"]')).toBeDisabled();
      await panel.locator('tbody .demo-resource-name').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(resource.id);
      await expect(dialog).toContainText(Object.keys(resourceTags(resource))[0]);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await choose('subscriptions');
      await expect(panel.locator('tbody tr')).toHaveCount(5);
      const empty = records(seed.subscriptions)[3];
      await panel.getByRole('button', { name: empty.subscriptionName, exact: true }).click();
      await expect(panel.locator('tbody tr')).toHaveCount(0);
      await expect(panel.locator('.demo-empty')).toBeVisible();
      await expect(panel.locator('[data-metric="resources"] strong')).toHaveText('0');
      await panel.locator('.demo-empty button').click();
      await expect(panel.locator('[data-metric="resources"] strong')).toHaveText('214');
      await choose('tags');
      await panel.locator('[data-control="tags"]').selectOption('without');
      const untagged = records(seed.resources).filter(
        (row) => Object.keys(resourceTags(row)).length === 0,
      );
      assert.deepEqual(
        await panel.locator('tbody .demo-resource-name').allTextContents(),
        untagged.map(({ name }) => name),
      );
      await choose('resources');
      const scope = records(seed.subscriptions)[1].subscriptionId;
      await panel.locator('[data-control="scope"]').selectOption(scope);
      await expect(panel.locator('[data-metric="resources"] strong')).toHaveText(
        String(
          records(seed.resources).filter(({ subscriptionId }) => subscriptionId === scope).length,
        ),
      );
      await panel.locator('[data-control="search"]').fill('not-a-real-resource');
      await expect(panel.locator('tbody tr')).toHaveCount(0);
      await expect(panel.locator('[data-demo-results]')).toContainText('0–0');
      await page.locator(`[data-set-lang="${locale === 'en' ? 'es' : 'en'}"]`).click();
      await expect(panel.locator('[data-control="search"]')).toHaveValue('not-a-real-resource');
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  });
}

test('FinOps simula costes de los recursos seleccionados, sin facturación cloud', async () => {
  const page = await state.browser.newPage({ locale: 'es' });
  const data = JSON.parse(
    await readFile(new URL('../site/assets/demo-data.json', import.meta.url), 'utf8'),
  );
  const money = (cents) =>
    new Intl.NumberFormat('es', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(cents / 100);
  try {
    await page.goto(state.url);
    await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
    const scope = data.subscriptions[1].id;
    await page.locator('#inventory-panel [data-control="scope"]').selectOption(scope);
    await page.locator('#finops-tab').click();
    const panel = page.locator('#finops-panel');
    await expect(panel.locator('[data-control="scope"]')).toHaveValue(scope);
    await expect(panel).toContainText('no son facturas ni precios de Azure');
    const scoped = data.resources.filter(({ subscriptionId }) => subscriptionId === scope);
    await expect(panel.locator('[data-metric="spend"] strong')).toHaveText(
      money(scoped.reduce((sum, row) => sum + row.demoCostCents, 0)),
    );
    await panel.locator('[data-control="month"]').selectOption('2026-09');
    await panel.locator('[data-control="basis"]').selectOption('amortized');
    await expect(panel.locator('[data-metric="spend"] strong')).toHaveText(
      money(scoped.reduce((sum, row) => sum + Math.round(row.demoCostCents * 1.1 * 0.8), 0)),
    );
    await panel.locator('[data-control="search"]').fill(scoped[0].name);
    await expect(panel.locator('tbody tr')).toHaveCount(1);
    await expect(panel.locator('tbody tr')).toContainText(
      money(Math.round(scoped[0].demoCostCents * 1.1 * 0.8)),
    );
  } finally {
    await page.close();
  }
});

test('los fallos de datos son visibles y la demo permite reintentar', async () => {
  const page = await state.browser.newPage({ locale: 'en' });
  try {
    await page.route('**/assets/demo-data.json', (route) =>
      route.fulfill({ status: 503, body: 'unavailable' }),
    );
    await page.goto(state.url);
    await expect(page.locator('.demo-status')).toHaveAttribute('role', 'alert');
    await expect(page.locator('.demo-status')).toContainText('could not be loaded');
    await expect(page.locator('.app-body')).toBeHidden();
    await page.unroute('**/assets/demo-data.json');
    await page.locator('.demo-status button').click();
    await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
    await expect(page.locator('.demo-status')).toBeHidden();
    await expect(page.locator('#inventory-panel [data-metric="resources"] strong')).toHaveText(
      '214',
    );
  } finally {
    await page.close();
  }
});
for (const locale of ['en', 'es']) {
  for (const width of [320, 390, 768, 1440]) {
    test(`la portada ${locale} funciona bajo la ruta de Pages a ${width}px`, async () => {
      const page = await state.browser.newPage({
        viewport: { width, height: 1000 },
        locale,
        reducedMotion: 'reduce',
      });
      const failures = [];
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('requestfailed', (request) => failures.push(request.url()));
      page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.status()}: ${response.url()}`);
      });
      page.on('request', (request) => {
        if (!request.url().startsWith(state.url))
          failures.push(`External request: ${request.url()}`);
      });
      try {
        await page.goto(state.url);
        await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        assert.equal(await page.locator('h1:visible').count(), 1);
        const providerMark = await readFile(
          new URL('../src/components/branding/ProviderMark/index.jsx', import.meta.url),
          'utf8',
        );
        await expect(page.locator('#i-azure path')).toHaveAttribute(
          'd',
          providerMark.match(/\sd="([^"]+)"/)[1],
        );
        await expect(page.locator('.hero .provider-mark')).toBeVisible();
        for (const tab of ['inventory', 'finops', 'users', 'admin']) {
          await page.locator(`#${tab}-tab`).click();
          await expect(page.locator(`#${tab}-panel`)).toBeVisible();
          await expect(page.locator(`#${tab}-tab`)).toHaveAttribute('aria-selected', 'true');
          if (['inventory', 'finops'].includes(tab)) {
            const scopeWidth = await page
              .locator(`#${tab}-panel [data-control="scope"]`)
              .evaluate((select) => select.getBoundingClientRect().width);
            assert.ok(
              scopeWidth > 0 && scopeWidth <= 240,
              'El selector de suscripciones debe medir como máximo 240 px',
            );
          }
          await expect(page.locator('.app-tabs [aria-selected="true"]')).toHaveCount(1);
          await expect(page.locator('.app-body [role="tabpanel"]:visible')).toHaveCount(1);
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            true,
            `${tab} overflows at ${width}px`,
          );
          await mkdir('test-results/site', { recursive: true });
          await page.screenshot({
            path: `test-results/site/${locale}-${width}-${tab}.png`,
            fullPage: true,
          });
        }
        const brokenAnchors = await page
          .locator('a[href^="#"]')
          .evaluateAll((links) =>
            links
              .map((link) => link.getAttribute('href'))
              .filter((href) => !document.getElementById(href.slice(1))),
          );
        assert.deepEqual(brokenAnchors, []);
        assert.deepEqual(failures, []);
      } finally {
        await page.close();
      }
    });
  }
}

for (const locale of ['en', 'es']) {
  test(`Usuarios permite cambios locales de rol y protege cuentas en ${locale}`, async () => {
    const page = await state.browser.newPage({
      locale,
      viewport: { width: locale === 'es' ? 390 : 1440, height: 1000 },
    });
    const writes = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') writes.push(request.url());
    });
    try {
      await page.goto(state.url);
      await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
      await page.locator('#users-tab').click();
      const panel = page.locator('#users-panel');
      await expect(panel.locator('[data-metric="accounts"] strong')).toHaveText('6');
      await expect(panel.locator('[data-metric="administrators"] strong')).toHaveText('2');
      await expect(panel.locator('[data-metric="enabled"] strong')).toHaveText('5');
      await expect(page.locator('.app-sidebar')).toBeHidden();
      await panel.locator('[data-control="page-size"]').selectOption('10');
      await expect(panel.locator('tbody tr')).toHaveCount(6);
      for (const name of ['Demo Admin', 'Demo Disabled']) {
        await expect(
          panel.getByRole('row').filter({ hasText: name }).locator('[data-member-action]'),
        ).toHaveCount(0);
      }
      await panel.locator('[data-control="role"]').selectOption('administrator');
      await expect(panel.locator('tbody tr')).toHaveCount(2);
      await panel.locator('[data-control="role"]').selectOption('member');
      await panel.locator('[data-control="search"]').fill('reader');
      await expect(panel.locator('tbody tr')).toHaveCount(1);
      await panel.locator('[data-member-action]').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('Demo Reader');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(panel.locator('[data-metric="administrators"] strong')).toHaveText('2');
      await panel.locator('[data-member-action]').click();
      await dialog.locator('[data-confirm-role]').click();
      await expect(dialog).toBeHidden();
      await expect(panel.locator('[data-metric="administrators"] strong')).toHaveText('3');
      await expect(panel.locator('.demo-notice')).toBeVisible();
      await expect(panel.locator('tbody tr')).toHaveCount(0);
      await panel.locator('.demo-empty button').click();
      const reader = panel.getByRole('row').filter({ hasText: 'Demo Reader' });
      await reader.locator('[data-member-action]').click();
      await dialog.locator('[data-confirm-role]').click();
      await expect(panel.locator('[data-metric="administrators"] strong')).toHaveText('2');
      await reader.locator('[data-member-action]').click();
      await dialog.locator('[data-confirm-role]').click();
      await expect(panel.locator('[data-metric="administrators"] strong')).toHaveText('3');
      await page.locator('#admin-tab').click();
      await page.locator('#users-tab').click();
      await expect(panel.locator('[data-metric="administrators"] strong')).toHaveText('3');
      await page.reload();
      await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
      await page.locator('#users-tab').click();
      await expect(panel.locator('[data-metric="administrators"] strong')).toHaveText('2');
      assert.deepEqual(writes, []);
    } finally {
      await page.close();
    }
  });

  test(`Administración guarda y descarta horarios solo en memoria en ${locale}`, async () => {
    const fixture = JSON.parse(
      await readFile(new URL('../site/assets/demo-data.json', import.meta.url), 'utf8'),
    ).management.administration;
    const executions = fixture.metrics.find(({ id }) => id === 'executions').data;
    const page = await state.browser.newPage({
      locale,
      viewport: { width: locale === 'es' ? 390 : 1440, height: 1000 },
    });
    const writes = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') writes.push(request.url());
    });
    try {
      await page.goto(state.url);
      await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
      await page.locator('#admin-tab').click();
      const panel = page.locator('#admin-panel');
      await expect(panel.locator('[data-save-schedule]')).toBeDisabled();
      await expect(panel.locator('[data-control="timer"]')).toBeChecked();
      await expect(panel.locator('[data-schedule-summary]')).toContainText('02:00 UTC');
      await expect(panel.locator('[data-metric="executions"] strong')).toHaveText(
        String(executions.slice(-24).reduce((sum, point) => sum + point.value, 0)),
      );
      await panel.locator('[data-control="metric-period"]').selectOption('168');
      await expect(panel.locator('[data-metric="executions"] strong')).toHaveText(
        String(executions.reduce((sum, point) => sum + point.value, 0)),
      );
      await panel.locator('[data-control="time"]').fill('04:15');
      await expect(panel.locator('[data-save-schedule]')).toBeEnabled();
      await panel.locator('[data-discard-schedule]').click();
      await expect(panel.locator('[data-control="time"]')).toHaveValue('02:00');
      await panel.locator('[data-control="time"]').fill('');
      await panel.locator('[data-save-schedule]').click();
      assert.equal(
        await panel.locator('.demo-schedule').evaluate((form) => form.checkValidity()),
        false,
      );
      await expect(panel.locator('[data-schedule-summary]')).toContainText('02:00 UTC');
      await expect(panel.locator('.demo-notice')).toBeHidden();
      await panel.locator('[data-control="time"]').fill('03:30');
      await panel.locator('[data-save-schedule]').click();
      await expect(panel.locator('[data-schedule-summary]')).toContainText('03:30 UTC');
      await expect(panel.locator('.demo-notice')).toBeVisible();
      await expect(panel.locator('[data-save-schedule]')).toBeDisabled();
      await panel.locator('[data-control="frequency"]').selectOption('hourly');
      await expect(panel.locator('[data-control="time"]')).toBeHidden();
      await expect(panel.locator('[data-control="time"]')).toBeDisabled();
      await panel.locator('[data-control="interval"]').selectOption('4');
      await panel.locator('[data-control="timer"]').uncheck();
      await panel.locator('[data-save-schedule]').click();
      await expect(panel.locator('[data-schedule-summary]')).toContainText(
        locale === 'es' ? 'Pausada' : 'Paused',
      );
      await page.locator('#inventory-tab').click();
      await page.locator('#admin-tab').click();
      await expect(panel.locator('[data-control="frequency"]')).toHaveValue('hourly');
      await expect(panel.locator('[data-control="interval"]')).toHaveValue('4');
      await expect(panel.locator('[data-control="timer"]')).not.toBeChecked();
      await page.reload();
      await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
      await page.locator('#admin-tab').click();
      await expect(panel.locator('[data-control="frequency"]')).toHaveValue('daily');
      await expect(panel.locator('[data-control="time"]')).toHaveValue('02:00');
      await expect(panel.locator('[data-control="timer"]')).toBeChecked();
      assert.deepEqual(writes, []);
    } finally {
      await page.close();
    }
  });
}

for (const locale of ['es', 'en']) {
  test(`Admin usa períodos, sincronización y etiquetas del producto en ${locale}`, async () => {
    const fixture = JSON.parse(
      await readFile(new URL('../site/assets/demo-data.json', import.meta.url), 'utf8'),
    ).management.administration;
    const page = await state.browser.newPage({
      locale,
      viewport: { width: locale === 'es' ? 1440 : 390, height: 1000 },
    });
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('request', (request) => {
      if (request.method() !== 'GET' || !request.url().startsWith(state.url))
        failures.push(request.url());
    });
    const panel = page.locator('#admin-panel');
    try {
      await page.goto(state.url);
      await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
      await page.locator('#admin-tab').click();
      assert.deepEqual(
        await panel
          .locator('[data-control="metric-period"] option')
          .evaluateAll((entries) => entries.map(({ value }) => Number(value))),
        METRIC_PERIODS,
      );
      for (const hours of METRIC_PERIODS) {
        await panel.locator('[data-control="metric-period"]').selectOption(String(hours));
        for (const metric of fixture.metrics) {
          const values = metric.data
            .slice(-hours)
            .map(({ value }) => value)
            .filter(Number.isFinite);
          const total = values.reduce((sum, value) => sum + value, 0);
          const result = metric.aggregation === 'Total' ? total : total / values.length;
          const divisor = metric.unit === 'bytes' ? 1048576 : 1;
          const suffix = { bytes: ' MiB', percent: ' %' }[metric.unit] || '';
          const expected = new Intl.NumberFormat(locale, {
            maximumFractionDigits: metric.unit === 'count' ? 0 : 1,
          }).format(result / divisor);
          await expect(panel.locator(`[data-metric="${metric.id}"] .admin-demo-value`)).toHaveText(
            `${expected}${suffix}`,
          );
        }
      }
      await panel.locator('[data-control="database-period"]').selectOption('24');
      await expect(panel.locator('[data-control="metric-period"]')).toHaveValue('24');
      await expect(panel.locator('[data-control="storage-period"]')).toHaveValue('24');
      await expect(panel.locator('[data-inventory-sync]')).toHaveAttribute(
        'data-inventory-sync',
        'synced',
      );
      const storage = panel.locator('[data-admin-service="storage"]');
      await storage.locator('[data-metric-view="traffic"]').click();
      const traffic = storage.locator('.admin-demo-chart');
      await expect(traffic.locator('svg polyline')).toHaveCount(3);
      await traffic.focus();
      await page.keyboard.press('End');
      for (const index of Array.from({ length: 7 }, (_, index) => index)) {
        await page.keyboard.press('ArrowLeft');
        if (index === 6) await expect(traffic.locator('.admin-demo-tooltip')).toContainText('—');
      }
      const database = panel.locator('[data-admin-service="database"]');
      await database.locator('[data-metric-view="connections"]').click();
      await expect(database.locator('.admin-demo-chart')).toHaveAttribute(
        'data-chart',
        'connections',
      );
      const refresh = panel.locator('[data-admin-refresh]');
      await expect(refresh.locator('svg use')).toHaveAttribute('href', '#i-refresh');
      const refreshSize = await refresh.locator('svg').boundingBox();
      assert.equal(refreshSize.width, 16);
      assert.equal(refreshSize.height, 16);
      await expect(page.locator('#i-refresh path')).toHaveCount(4);
      const configuration = panel.locator('.admin-demo-configuration > .admin-demo-card');
      const functionBounds = await configuration.nth(0).boundingBox();
      const scheduleBounds = await configuration.nth(1).boundingBox();
      if (locale === 'es') {
        assert.equal(functionBounds.y, scheduleBounds.y);
        assert.equal(functionBounds.height, scheduleBounds.height);
      } else {
        assert.ok(scheduleBounds.y >= functionBounds.y + functionBounds.height);
      }
      await refresh.click();
      await expect(refresh).toHaveAttribute('aria-busy', 'true');
      await expect(refresh.locator('svg')).toHaveClass(/admin-demo-spin/);
      await expect(panel.locator('[data-metric="executions"] .admin-demo-value')).toBeVisible();
      await expect(refresh).toHaveAttribute('aria-busy', 'false');
      await expect(refresh.locator('svg')).not.toHaveClass(/admin-demo-spin/);
      await panel.screenshot({ path: `test-results/site/admin-detailed-${locale}.png` });
      await panel.locator('[data-control="admin-scenario"]').selectOption('newer');
      await expect(panel.locator('[data-inventory-sync]')).toHaveAttribute(
        'data-inventory-sync',
        'storageNewer',
      );
      await panel.locator('[data-inventory-sync] button').click();
      await expect(page.locator('#inventory-tab')).toHaveAttribute('aria-selected', 'true');
      await page.locator('#admin-tab').click();
      await panel.locator('[data-control="admin-scenario"]').selectOption('unavailable');
      await expect(panel.locator('[data-inventory-sync]')).toHaveAttribute(
        'data-inventory-sync',
        'unknown',
      );
      await expect(database.locator('.admin-demo-size')).toHaveText('—');
      await expect(storage.locator('.admin-demo-size')).toHaveText('—');
      await expect(panel.locator('.admin-demo-data .admin-demo-chart')).toHaveCount(0);
      await expect(panel.locator('.admin-demo-unavailable')).toHaveCount(2);
      await panel.locator('[data-control="admin-scenario"]').selectOption('healthy');
      await panel.locator('[data-control="time"]').fill('03:45');
      await panel.locator('[data-control="admin-scenario"]').selectOption('collecting');
      await expect(panel.locator('[data-save-schedule]')).toBeDisabled();
      await expect(panel.locator('[data-control="time"]')).toBeDisabled();
      await expect(panel.locator('[data-save-tags]')).toBeDisabled();
      await panel.locator('[data-control="admin-scenario"]').selectOption('healthy');
      await expect(panel.locator('[data-control="time"]')).toHaveValue('03:45');
      await panel.locator('[data-save-schedule]').click();
      await expect(panel.locator('[data-schedule-cron]')).toHaveText(
        validateSchedule({
          enabled: true,
          mode: 'daily',
          time: '03:45',
          version: '0'.repeat(64),
        }).cron,
      );
      await panel.locator('[data-control="frequency"]').selectOption('hourly');
      await panel.locator('[data-control="interval"]').selectOption('4');
      await panel.locator('[data-save-schedule]').click();
      await expect(panel.locator('[data-schedule-cron]')).toHaveText(
        validateSchedule({
          enabled: true,
          mode: 'hourly',
          hours: 4,
          version: '0'.repeat(64),
        }).cron,
      );
      await panel.locator('[data-clear-tags]').click();
      await expect(panel.locator('[data-save-tags]')).toBeDisabled();
      await expect(panel.locator('.admin-demo-tag-options input:checked')).toHaveCount(0);
      await panel.locator('[data-control="tags-automatic"]').check();
      await panel.locator('[data-save-tags]').click();
      await expect(panel.locator('[data-save-tags]')).toBeDisabled();
      await expect(panel.locator('.admin-demo-tag-options input').first()).toBeDisabled();
      await panel.locator('[data-control="tags-automatic"]').uncheck();
      await panel.locator('[data-clear-tags]').click();
      await panel.locator('[data-control="admin-tags-search"]').fill('environment');
      await panel.locator('[data-tag-key="environment"]').check();
      await expect(panel.locator('[data-tag-key="environment"]')).toBeFocused();
      await panel.locator('[data-save-tags]').click();
      await expect(panel.locator('.demo-notice')).toBeVisible();
      await page.locator('#inventory-tab').click();
      const tagsLink = page.locator('[data-view="tags"]');
      if (await tagsLink.isVisible()) await tagsLink.click();
      else await page.locator('#inventory-panel [data-control="view"]').selectOption('tags');
      await expect(page.locator('#inventory-panel th')).toHaveCount(3);
      await expect(page.locator('#inventory-panel th').last()).toHaveText('environment');
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(failures, []);
    } finally {
      await page.close();
    }
  });
}

test('la tarjeta social incluye imagen y metadatos estáticos sin JavaScript', async () => {
  const page = await state.browser.newPage({
    javaScriptEnabled: false,
    userAgent: 'Twitterbot/1.0',
  });
  const publicUrl = 'https://danieljsaldana.github.io/goliat-cloud-inventory/';
  const imageUrl = `${publicUrl}assets/cloud-inventory.png`;
  const title = 'Goliat — Cloud Inventory';
  const description = 'Your Azure, in perspective. Open-source inventory and FinOps, in one place.';
  const alt = 'Goliat - Cloud Inventory logo and an illustration of Azure cloud resources.';
  try {
    await page.goto(state.url);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', publicUrl);
    for (const [property, content] of Object.entries({
      'og:type': 'website',
      'og:site_name': 'Goliat - Cloud Inventory',
      'og:url': publicUrl,
      'og:locale': 'en_US',
      'og:title': title,
      'og:description': description,
      'og:image': imageUrl,
      'og:image:type': 'image/png',
      'og:image:width': '1730',
      'og:image:height': '909',
      'og:image:alt': alt,
    })) {
      const meta = page.locator(`head meta[property="${property}"]`);
      await expect(meta).toHaveCount(1);
      await expect(meta).toHaveAttribute('content', content);
    }
    for (const [name, content] of Object.entries({
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': imageUrl,
      'twitter:image:alt': alt,
    })) {
      const meta = page.locator(`head meta[name="${name}"]`);
      await expect(meta).toHaveCount(1);
      await expect(meta).toHaveAttribute('content', content);
    }
    const response = await page.request.get(new URL(new URL(imageUrl).pathname, state.url).href);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['content-type'], 'image/png');
    const bytes = await response.body();
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), 1730);
    assert.equal(bytes.readUInt32BE(20), 909);
    assert.deepEqual(
      bytes,
      await readFile(new URL('../public/social/cloud-inventory.png', import.meta.url)),
    );
  } finally {
    await page.close();
  }
});

test('idioma persistente, enlaces localizados y pestañas accesibles por teclado', async () => {
  const page = await state.browser.newPage({ locale: 'en' });
  try {
    await page.goto(state.url);
    await page.locator('[data-set-lang="es"]').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('[data-doc-link]')).toHaveAttribute('href', /README\.es\.md#/);
    await page.locator('#inventory-tab').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#finops-tab')).toBeFocused();
    await expect(page.locator('#finops-panel')).toBeVisible();
    await expect(page.locator('#inventory-panel')).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#users-tab')).toBeFocused();
    await expect(page.locator('#users-panel')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#admin-tab')).toBeFocused();
    await expect(page.locator('#admin-panel')).toBeVisible();
    await page.keyboard.press('Home');
    await expect(page.locator('#inventory-tab')).toBeFocused();
    await expect(page.locator('#inventory-panel')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#admin-tab')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#admin-panel')).toBeFocused();
    await page.locator('[data-set-lang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('[data-doc-link]')).toHaveAttribute('href', /#quick-start$/);
    await expect(page.locator('#admin-panel')).toBeVisible();
  } finally {
    await page.close();
  }
});

test('la portada conserva contenido sin JavaScript y funciona sin almacenamiento', async () => {
  const noScript = await state.browser.newPage({ javaScriptEnabled: false });
  const noStorage = await state.browser.newPage({ locale: 'es' });
  try {
    await noScript.goto(state.url);
    await expect(noScript.locator('#inventory-panel')).toBeVisible();
    await expect(noScript.locator('h1')).toContainText('Your Azure inventory.');
    await expect(noScript.locator('.diagram-select')).toBeHidden();
    await expect(noScript.locator('.architecture-diagram noscript a')).toHaveAttribute(
      'href',
      'assets/azure-deployment.html?theme=light',
    );
    await noStorage.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Storage blocked', 'SecurityError');
        },
      });
    });
    await noStorage.goto(state.url);
    await expect(noStorage.locator('html')).toHaveAttribute('lang', 'es');
    await noStorage.locator('[data-set-lang="en"]').click();
    await expect(noStorage.locator('html')).toHaveAttribute('lang', 'en');
    await noStorage.locator('#finops-tab').click();
    await expect(noStorage.locator('#finops-panel')).toBeVisible();
  } finally {
    await noScript.close();
    await noStorage.close();
  }
});

test('Archify reutiliza los documentos publicados y conserva el aislamiento', async () => {
  for (const name of ['architecture', 'azure-deployment']) {
    assert.deepEqual(
      await readFile(new URL(`../site/assets/${name}.html`, import.meta.url)),
      await readFile(new URL(`../docs/${name}.html`, import.meta.url)),
    );
  }
  const page = await state.browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(state.url);
    const iframe = page.locator('.architecture-diagram iframe');
    await iframe.scrollIntoViewIfNeeded();
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-downloads');
    const frame = page.frameLocator('.architecture-diagram iframe');
    await expect(frame.locator('#node-api')).toBeVisible();
    await expect(frame.locator('#node-cost')).toBeVisible();
    await expect(frame.locator('html')).toHaveAttribute('data-present', 'true');
    await expect(page.locator('a[rel="author"]')).toHaveAttribute(
      'href',
      'https://danieljsaldana.dev',
    );
    await page.locator('#how').screenshot({
      path: 'test-results/site/archify-desktop.png',
      style: '.site-header, .skip-link { visibility: hidden; }',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const diagram = frame.locator('.diagram-container > svg');
    await expect
      .poll(() =>
        diagram.evaluate(
          (svg) => svg.getBoundingClientRect().width <= svg.parentElement.clientWidth,
        ),
      )
      .toBe(true);
    const initialTransform = await diagram.getAttribute('style');
    await frame.getByRole('button', { name: 'Acercar', exact: true }).click();
    await expect(diagram).not.toHaveAttribute('style', initialTransform);
    await frame.getByRole('button', { name: /Restablecer la vista del diagrama/ }).click();
    await expect(diagram).toHaveAttribute('style', /scale\(1\)/);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
    );
    await page.locator('#how').screenshot({
      path: 'test-results/site/archify-mobile.png',
      style: '.site-header, .skip-link { visibility: hidden; }',
    });
  } finally {
    await page.close();
  }
});

for (const [locale, width] of [
  ['es', 1440],
  ['en', 320],
]) {
  test(`el selector Archify cambia ambos diagramas y conserva el zoom al traducir en ${locale}`, async () => {
    const page = await state.browser.newPage({ locale, viewport: { width, height: 1000 } });
    const navigations = [];
    const failures = [];
    page.on('framenavigated', (frame) => {
      if (
        frame !== page.mainFrame() &&
        /assets\/(?:architecture|azure-deployment)\.html/.test(frame.url())
      )
        navigations.push(frame.url());
    });
    page.on('pageerror', (error) => failures.push(error.message));
    try {
      await page.goto(state.url);
      const select = page.locator('#diagram-select');
      const iframe = page.locator('#architecture-document');
      await expect(select).toBeVisible();
      await expect(select).toHaveAccessibleName(locale === 'es' ? 'Diagrama' : 'Diagram');
      await iframe.scrollIntoViewIfNeeded();
      const frame = page.frameLocator('#architecture-document');
      await expect(frame.locator('#node-api')).toBeVisible();
      await select.selectOption('azure');
      await expect(iframe).toHaveAttribute(
        'src',
        'assets/azure-deployment.html?theme=light&present=1',
      );
      await expect(frame.locator('#node-web')).toBeVisible();
      await expect(frame.locator('#node-function')).toBeVisible();
      await expect(page.locator('[data-full-diagram]')).toHaveAttribute(
        'href',
        'assets/azure-deployment.html?theme=light',
      );
      await expect(page.locator('[data-diagram-help="azure"]')).toBeVisible();
      await expect(page.locator('[data-diagram-help="application"]')).toBeHidden();
      await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-downloads');
      const diagram = frame.locator('.diagram-container > svg');
      await frame.getByRole('button', { name: 'Acercar', exact: true }).click();
      await expect(diagram).not.toHaveAttribute('data-view-scale', '1');
      const scale = await diagram.getAttribute('data-view-scale');
      const transform = await diagram.evaluate((svg) => svg.style.transform);
      const count = navigations.length;
      const nextLocale = locale === 'es' ? 'en' : 'es';
      await page.locator(`[data-set-lang="${nextLocale}"]`).click();
      await expect(select).toHaveValue('azure');
      await expect(iframe).toHaveAttribute(
        'title',
        nextLocale === 'es' ? 'Archify — Despliegue en Azure' : 'Archify — Azure deployment',
      );
      await expect(diagram).toHaveAttribute('data-view-scale', scale);
      await expect.poll(() => diagram.evaluate((svg) => svg.style.transform)).toBe(transform);
      assert.equal(navigations.length, count, 'Cambiar de idioma no recarga el iframe');
      await select.focus();
      await page.keyboard.press('a');
      await page.keyboard.press('Tab');
      await expect(select).toHaveValue('application');
      await expect(frame.locator('#node-api')).toBeVisible();
      await expect(page.locator('[data-full-diagram]')).toHaveAttribute(
        'href',
        'assets/architecture.html?theme=light',
      );
      await expect(page.locator('[data-diagram-help="application"]')).toBeVisible();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.ok((await select.boundingBox()).width <= 220);
      await page.locator('.architecture-diagram').screenshot({
        path: `test-results/site/diagram-selector-${width}.png`,
        style: '.site-header, .skip-link { visibility: hidden; }',
      });
      assert.deepEqual(failures, []);
    } finally {
      await page.close();
    }
  });
}

test('hover, selección y foco del menú se distinguen sin invadir la fila vecina', async () => {
  const page = await state.browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: 'es',
  });
  try {
    await page.goto(state.url);
    await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
    const selected = page.locator('[data-view="compute"]');
    const neighbor = page.locator('[data-view="containers"]');
    await selected.click();
    await neighbor.hover();
    await expect(selected).toHaveCSS('background-color', 'rgb(237, 246, 255)');
    await expect(neighbor).toHaveCSS('background-color', 'rgb(242, 248, 255)');
    await expect(neighbor).toHaveCSS('box-shadow', 'none');
    await expect(selected).toHaveCSS('font-weight', '600');
    await expect(page.locator('.app-sidebar [aria-current="page"]')).toHaveCount(1);
    await page.locator('.app-sidebar').screenshot({ path: 'test-results/site/menu-hover.png' });
    const selectedStyle = await selected.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      shadow: getComputedStyle(element).boxShadow,
    }));
    await selected.hover();
    assert.deepEqual(
      await selected.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        shadow: getComputedStyle(element).boxShadow,
      })),
      selectedStyle,
    );
    await selected.focus();
    await page.keyboard.press('Tab');
    await expect(neighbor).toBeFocused();
    await expect(neighbor).toHaveCSS('outline-width', '2px');
    await expect(neighbor).toHaveCSS('outline-offset', '-2px');
    const first = await selected.boundingBox();
    const second = await neighbor.boundingBox();
    assert.ok(first.y + first.height <= second.y);
    await page.locator('.app-sidebar').screenshot({ path: 'test-results/site/menu-states.png' });
    await page.keyboard.press('Enter');
    await expect(neighbor).toHaveAttribute('aria-current', 'page');
    await expect(selected).not.toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#inventory-panel [data-metric="resources"] strong')).toHaveText('6');
  } finally {
    await page.close();
  }
});

for (const width of [320, 390, 768, 1440]) {
  test(`paginación numerada sin solapamientos a ${width}px`, async () => {
    const page = await state.browser.newPage({
      viewport: { width, height: 1000 },
      locale: 'es',
      hasTouch: width <= 540,
    });
    const panel = page.locator('#inventory-panel');
    const pagination = panel.locator('.demo-pagination');
    try {
      await page.goto(state.url);
      await expect(page.locator('.dashboard')).toHaveAttribute('data-demo-ready', 'true');
      await expect(pagination).toHaveAttribute('aria-label', /Paginación:/);
      await expect(pagination.locator('[data-page="previous"]')).toBeDisabled();
      await expect(pagination.locator('[aria-current="page"]')).toHaveText('1');
      await pagination.locator('[data-page-number="43"]').click();
      await expect(pagination.locator('[aria-current="page"]')).toHaveText('43');
      await expect(pagination.locator('[data-page="next"]')).toBeDisabled();
      await expect(panel.locator('tbody tr')).toHaveCount(4);
      await expect(pagination.locator('[data-demo-results]')).toContainText('211–214');
      await pagination.locator('[data-page-number="1"]').click();
      for (const index of [2, 3, 4, 5, 6]) {
        await pagination.locator('[data-page="next"]').click();
        await expect(pagination.locator('[aria-current="page"]')).toHaveText(String(index));
      }
      await expect(pagination.locator('.demo-page-ellipsis')).toHaveCount(2);
      assert.deepEqual(
        await panel.locator('tbody .demo-resource-name').allTextContents(),
        records(seed.resources)
          .slice(25, 30)
          .map(({ name }) => name),
      );
      await pagination.scrollIntoViewIfNeeded();
      const bounds = await pagination.boundingBox();
      const controls = pagination.locator('.demo-page-button:visible');
      const boxes = await Promise.all(
        (await controls.all()).map((control) => control.boundingBox()),
      );
      assert.ok(
        boxes.every((box) => Math.abs(box.y - boxes[0].y) < 1),
        'Las flechas y los números deben permanecer en una misma fila',
      );
      for (const [index, box] of boxes.entries()) {
        assert.ok(
          box.x >= bounds.x - 1 && box.x + box.width <= bounds.x + bounds.width + 1,
          'Control fuera de la paginación',
        );
        assert.ok(box.height >= (width <= 540 ? 44 : 32), 'Control demasiado pequeño');
        for (const other of boxes.slice(index + 1)) {
          const overlaps =
            box.x < other.x + other.width &&
            box.x + box.width > other.x &&
            box.y < other.y + other.height &&
            box.y + box.height > other.y;
          assert.equal(overlaps, false, 'Los controles no deben solaparse');
        }
      }
      const range = await pagination.locator('[data-demo-results]').boundingBox();
      const size = await pagination.locator('.demo-field').boundingBox();
      const navigation = await pagination.locator('.demo-page-navigation').boundingBox();
      const controlsOverlapText = [range, size].some(
        (box) =>
          navigation.x < box.x + box.width &&
          navigation.x + navigation.width > box.x &&
          navigation.y < box.y + box.height &&
          navigation.y + navigation.height > box.y,
      );
      assert.equal(controlsOverlapText, false);
      if (width === 1440) {
        const current = pagination.locator('[data-page-number="6"]');
        await current.focus();
        await page.keyboard.press('Enter');
        await expect(current).toBeFocused();
        await expect(current).toHaveCSS('outline-offset', '-2px');
        const background = await current.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        );
        await current.hover();
        await expect(current).toHaveCSS('background-color', background);
      }
      await pagination.screenshot({
        path: `test-results/site/pagination-${width}.png`,
        style: '.site-header, .skip-link { visibility: hidden; }',
      });
      await panel.locator('[data-control="page-size"]').selectOption('20');
      await expect(pagination.locator('[aria-current="page"]')).toHaveText('1');
      await expect(panel.locator('tbody tr')).toHaveCount(20);
      await panel.locator('[data-control="search"]').fill('nonexistent-resource');
      await expect(pagination.locator('[data-page-number]')).toHaveCount(0);
      await expect(pagination.locator('[data-page="previous"]')).toBeDisabled();
      await expect(pagination.locator('[data-page="next"]')).toBeDisabled();
      await expect(pagination.locator('.demo-page')).toHaveText('Sin páginas');
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    } finally {
      await page.close();
    }
  });
}
