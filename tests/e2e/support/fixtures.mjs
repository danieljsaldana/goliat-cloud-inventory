import { test as base, expect } from '@playwright/test';
import { translate } from '../../../src/core/i18n/translate.js';
import { E2E_ORIGIN, E2E_USERNAME, E2E_PASSWORD } from './constants.mjs';

export async function signIn(page, locale, destination = `/${locale}/inventario/`) {
  await page.goto(destination, { waitUntil: 'domcontentloaded' });
  await page.locator('#username').fill(E2E_USERNAME);
  await page.locator('#password').fill(E2E_PASSWORD);
  await page.locator('.login-form button[type=submit]').click();
  await expect(page).toHaveURL((url) => url.origin === E2E_ORIGIN && url.pathname === destination);
}

export const test = base.extend({
  locale: async ({}, use, info) => {
    await use(info.project.metadata.locale);
  },
  t: async ({ locale }, use) => {
    await use((key, values) => translate(locale, key, values));
  },
  signedInPage: async ({ page, locale }, use) => {
    await signIn(page, locale);
    await expect(page.locator('.kpi-grid .kpi').first()).toBeVisible();
    await use(page);
  },
  runtimeErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !/^Failed to load resource:/.test(message.text())) {
          errors.push(message.text());
        }
      });
      await use(errors);
      expect(errors, 'La interfaz no debe producir errores JavaScript ni de hidratación.').toEqual(
        [],
      );
    },
    { auto: true },
  ],
});

export { expect };
