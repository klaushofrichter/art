import { test, expect } from '@playwright/test';

test('the lobby opens on the first room', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('.lpanel .cap .n').first()).toHaveText('Colors');
  await expect(page.locator('.enter').first()).toBeVisible();
});

test('a room opens from the Enter button, and only from it', async ({ page }) => {
  await page.goto('/');
  // Clicking the panel itself must do nothing — entering is deliberate.
  await page.locator('.lpanel').first().click({ position: { x: 700, y: 200 } });
  await expect(page.locator('.room')).toHaveCount(0);

  await page.locator('.enter').first().click();
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('Undertow');
});

test('a click clears the label and another brings it back', async ({ page }) => {
  await page.goto('/#colors');
  await page.locator('.enter').first().click();
  const room = page.locator('.room');
  await expect(room).not.toHaveClass(/bare/);
  await page.locator('.rail').last().click({ position: { x: 400, y: 200 } });
  await expect(room).toHaveClass(/bare/);
  await page.locator('.rail').last().click({ position: { x: 400, y: 200 } });
  await expect(room).not.toHaveClass(/bare/);
});

test('Space toggles the short label', async ({ page }) => {
  await page.goto('/');
  await page.locator('.enter').first().click();
  await expect(page.locator('.mini')).not.toHaveClass(/on/);
  await page.keyboard.press('Space');
  await expect(page.locator('.mini')).toHaveClass(/on/);
  await expect(page.locator('.mini')).toContainText('Undertow');
  await page.keyboard.press('Space');
  await expect(page.locator('.mini')).not.toHaveClass(/on/);
});

test('Escape unwinds one level at a time', async ({ page }) => {
  await page.goto('/');
  await page.locator('.enter').first().click();
  const room = page.locator('.room');
  await page.locator('.rail').last().click({ position: { x: 400, y: 200 } });
  await expect(room).toHaveClass(/bare/);
  await page.keyboard.press('Escape');            // first: the label returns
  await expect(room).not.toHaveClass(/bare/);
  await page.keyboard.press('Escape');            // then: back to the lobby
  await expect(page.locator('.room')).toHaveCount(0);
  await expect(page.locator('.enter').first()).toBeVisible();
});

test('the side menu lists rooms in the lobby and pictures in a room', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rooms' }).click();
  await expect(page.locator('.menu.on .mitem')).toHaveCount(4);
  await page.keyboard.press('Escape');

  await page.locator('.enter').first().click();
  await page.getByRole('button', { name: 'Pictures' }).click();
  // Strict tree: this room's three pictures, and no way sideways.
  await expect(page.locator('.menu.on .mitem')).toHaveCount(3);
});

test('a deep link opens straight to one picture', async ({ page }) => {
  await page.goto('/#dogs/close');
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('Close');
});

test('a sold picture shows no price, and still hangs', async ({ page }) => {
  await page.goto('/#colors/ember');
  await expect(page.locator('.info h2')).toHaveText('Ember');
  await expect(page.locator('.info .status')).toHaveText('Sold');
  await expect(page.locator('.info .price')).toHaveCount(0);
  await expect(page.locator('.plate .art').first()).toBeVisible();
});

test('the About room reads in place instead of opening', async ({ page }) => {
  await page.goto('/#about');
  await expect(page.locator('.abody .n')).toHaveText('Klaus Hofrichter');
  await expect(page.locator('.abody strong')).toHaveText('the dog');
  await expect(page.locator('.room')).toHaveCount(0);
});

test('the pictures actually load at the URLs the client builds', async ({ page }) => {
  // The browser derives every src from a prefix plus encoded ids rather than
  // taking a URL from the manifest — this is the guard on that construction.
  await page.goto('/#colors/undertow');
  const art = page.locator('.plate .art').first();
  await expect(art).toBeVisible();
  await expect.poll(() => art.evaluate((n: HTMLImageElement) => n.naturalWidth)).toBeGreaterThan(0);
  await expect(art).toHaveAttribute('src', '/assets/colors/IMG_7281.jpg');
});

test('the buy link points at the canonical purchase page', async ({ page }) => {
  await page.goto('/#colors/undertow');
  await expect(page.locator('.info .buy')).toHaveAttribute('href', '/buy/colors/undertow');
});

test('the purchase page is reachable and priced', async ({ page }) => {
  await page.goto('/buy/colors/undertow');
  await expect(page.locator('h1')).toHaveText('Undertow');
  await expect(page.locator('.price')).toHaveText('$340');
  await expect(page.locator('.buyside .by')).toContainText('March 2024');
});

test('/health reports the content it loaded', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe('ok');
  expect(body.service).toBe('art');
  expect(body.rooms).toBe(4);
  expect(body.works).toBe(15);
});
