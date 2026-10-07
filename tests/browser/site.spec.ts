import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('participant registers, submits CSV, appears in leaderboard; admin manages the real application', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/register');
  await page.getByLabel('Имя и фамилия').fill('Анна Тестовая');
  await page.locator('input[name="telegram"]').fill('@anna_test');
  await page.getByLabel('Ник участника').fill('anna_ml');
  await page.locator('input[name="consent"]').check();
  await page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Заявка принята.' })).toBeVisible();
  const code = await page.locator('.receipt-code code').textContent(); expect(code?.length).toBe(48);
  await page.getByRole('link', { name: 'Перейти к заданию' }).click();
  await expect(page.getByLabel('Личный код участника')).toHaveValue(code!);
  const csv = await (await page.request.get('/api/challenge/sample_submission.csv')).body();
  await page.getByLabel('Ссылка на ноутбук или репозиторий').fill('https://github.com/example/ml');
  await page.locator('input[type="file"]').setInputFiles({ name: 'submission.csv', mimeType: 'text/csv', buffer: csv });
  await page.locator('.submission-form button').click();
  await expect(page.locator('.submission-form [role="status"]')).toBeVisible();
  await page.goto('/leaderboard'); await expect(page.getByRole('cell', { name: 'anna_ml' })).toBeVisible();
  await page.goto('/admin'); await page.locator('input[name="password"]').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Анна Тестовая' })).toBeVisible();
  await page.getByLabel('Статус заявки Анна Тестовая').selectOption('confirmed');
  await expect(page.getByText('Статус обновлён.')).toBeVisible();
  await page.getByRole('button', { name: 'Анна Тестовая' }).click();
  await expect(page.getByRole('link', { name: 'Открыть ноутбук или репозиторий' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('heading', { name: 'Вход в кабинет.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('pages are accessible and fit narrow screens', async ({ page }) => {
  test.setTimeout(120000);
  for (const route of ['/', '/register', '/challenge', '/prepare', '/prepare/honest-validation', '/leaderboard', '/admin', '/events/start', '/events/vibe', '/privacy']) {
    await page.goto(route); await expect(page.locator('h1')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations, route).toEqual([]);
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}`).toBeTruthy();
    }
  }
});

test('home screenshots and mobile menu keyboard interaction', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: false });
  const trigger = page.getByRole('button', { name: /Открыть меню/ }); await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(trigger).toBeFocused();
});
