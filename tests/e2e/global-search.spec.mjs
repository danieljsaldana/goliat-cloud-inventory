import { test, expect } from './support/fixtures.mjs';

test('la búsqueda global abre con teclado, encuentra etiquetas y navega al recurso de otra suscripción', async ({
  signedInPage: page,
  t,
  locale,
}) => {
  await page.getByRole('combobox', { name: t('subscriptions.label') }).click();
  await page.getByRole('option', { name: 'Demo - Desarrollo', exact: true }).click();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: t('globalSearch.title') });
  const input = dialog.getByRole('combobox');
  await expect(input).toBeFocused();
  await input.fill('tesoreria');
  const resource = dialog.getByRole('option').filter({ hasText: 'apim-demo-prod' });
  await expect(resource).toHaveCount(1);
  const options = dialog.getByRole('option');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await input.fill('apim-demo-prod');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/${locale}/inventario/api-management/\\?q=`));
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(1);
  await expect(page.locator('.table-panel tbody tr')).toContainText('apim-demo-prod');
  await expect(page.getByRole('combobox', { name: t('subscriptions.label') })).toContainText(
    'Demo - Producción',
  );
  await page.reload();
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: t('globalSearch.open'), exact: true }).click();
  await dialog.getByRole('combobox').fill('apim-demo-dev');
  await dialog.getByRole('option').filter({ hasText: 'apim-demo-dev' }).click();
  await expect(page.locator('.table-panel tbody tr')).toHaveCount(1);
  await expect(page.locator('.table-panel tbody tr')).toContainText('apim-demo-dev');
});

test('el botón funciona en móvil, muestra cero resultados y Escape devuelve el foco', async ({
  signedInPage: page,
  t,
}) => {
  const trigger = page.getByRole('button', { name: t('globalSearch.open'), exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: t('globalSearch.title') });
  await dialog.getByRole('combobox').fill('no-existe-en-azure');
  await expect(dialog.getByText(t('globalSearch.noResults'))).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Meta+k');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox')).toHaveValue('');
});
