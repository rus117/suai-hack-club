import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { materials } from '../../src/materials';

test('learning routes preserve progress and keep the selected track between lessons', async ({ page }) => {
  await page.goto('/prepare');
  await expect(page.getByRole('heading', { name: 'Все модули' })).toBeVisible();
  await expect(page.locator('.material-row')).toHaveCount(12);
  await page.getByRole('button', { name: 'Выбрать маршрут Вайбкодинг' }).click();
  await expect(page).toHaveURL(/track=vibe/);
  await expect(page.locator('.material-row')).toHaveCount(7);
  await page.locator('.material-row').first().click();
  await expect(page.getByRole('heading', { name: 'Задача, команда и план на один день', exact: true })).toBeVisible();
  await expect(page.locator('.quiz-item details').first()).not.toHaveAttribute('open', '');
  await page.locator('.quiz-item summary').first().click();
  await expect(page.locator('.quiz-item details').first()).toHaveAttribute('open', '');
  const completion = page.getByLabel('Я выполнил практику и разобрал вопросы');
  await completion.check();
  await page.reload();
  await expect(completion).toBeChecked();
  await page.getByRole('link', { name: 'Дальше: Как устроено веб-приложение' }).click();
  await expect(page).toHaveURL(/web-foundations\?track=vibe/);
  await page.getByRole('link', { name: 'К маршруту вайбкодинга' }).click();
  await expect(page.getByLabel('Завершено 1 из 7')).toHaveAttribute('value', '1');
  await expect(page.locator('.material-row').first()).toContainText('ЗАВЕРШЕНО');
  const notebook = await page.request.get('/learning/campus-ml-workbook.ipynb');
  expect(notebook.ok()).toBeTruthy();
  const document = await notebook.json();
  expect(document.nbformat).toBe(4);
  expect(document.cells.filter((c: { cell_type: string }) => c.cell_type === 'code').length).toBeGreaterThan(5);
  expect((await page.request.get('/learning/workbook.md')).ok()).toBeTruthy();
});

test('every lesson renders its practice, questions, sources and fits mobile', async ({ page }) => {
  test.setTimeout(120000);
  for (const material of materials) {
    await page.goto(`/prepare/${material.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(material.title);
    await expect(page.locator('#practice ol li')).toHaveCount(5);
    await expect(page.locator('.quiz-item')).toHaveCount(3);
    await expect(page.locator('.lesson-resources article')).toHaveCount(material.resources.length);
    await expect(page).toHaveTitle(`${material.title} — SUAI Hack Club`);
    await page.setViewportSize({ width: 375, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), material.slug).toBeTruthy();
  }
  for (const route of ['/prepare', '/prepare/ml-first-model', '/prepare/web-quality']) {
    await page.goto(route); await expect(page.locator('h1')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations, route).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/prepare'); await expect(page.locator('h1')).toBeVisible(); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/prepare-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/prepare-mobile.png' });
  await page.goto('/prepare/ml-first-model'); await expect(page.locator('h1')).toBeVisible();
  await page.screenshot({ path: 'test-results/lesson-mobile.png' });
});

test('learning remains usable when local storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } });
  });
  await page.goto('/prepare/ml-data');
  await page.getByLabel('Я выполнил практику и разобрал вопросы').check();
  await expect(page.getByText('Сохранение в браузере недоступно.', { exact: false })).toBeVisible();
  await expect(page.locator('#practice')).toBeVisible();
});
