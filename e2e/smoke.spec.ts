import { test, expect } from '@playwright/test';

test('gallery page loads', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Gallery');
  await expect(page.locator('#app-version')).toBeVisible();
});

test('/health reports ok', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe('ok');
  expect(body.service).toBe('art');
  expect(typeof body.version).toBe('string');
});
