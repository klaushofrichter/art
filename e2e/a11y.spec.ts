/**
 * Accessibility: WCAG 2.2 level A and AA, checked by axe-core in a real
 * browser, on every kind of page and in every state the gallery has: the
 * lobby on each room's panel, each room with its label, the menus (the
 * gallery's dialogs), full screen with the short title, the About room, the
 * purchase pages, the legal pages and the 404. Zero violations is the bar,
 * plus the contrast measured on screen in helpers.ts `audit()` for the words
 * that sit over pictures, which axe leaves undecided.
 *
 * The site has one design, dark, and no prefers-color-scheme rules, so it is
 * audited once, in the scheme it is written for. If a light theme is ever
 * added, audit it here too. Reduced motion keeps the springs and the
 * wandering light still while the screen is measured.
 */
import { Page } from '@playwright/test';
import { test, expect, site, open, audit, expectPlateLoaded, expectCoversLoaded, scrollThrough, expectAllPicturesLoaded } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
});

/** Keep the pointer over the gallery, where a visitor's is: with it outside
 *  the window the controls deliberately dim to a third, and nobody reads
 *  them in that state. */
async function hover(page: Page) {
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height / 2);
}

test('@live the lobby, on every room\'s panel, meets WCAG 2.2 AA', async ({ page, request }) => {
  const rooms = await site(request);
  for (const room of rooms) {
    // A deep link lands on the panel without the greeting card.
    await open(page, `/#${room.id}`);
    await expect(page.locator('.lpanel .cap .n').nth(rooms.indexOf(room))).toBeInViewport();
    await expectCoversLoaded(page, await page.locator('.lpanel:not(.nocover)').count());
    await hover(page);
    await audit(page);
  }
});

test('@live the Rooms menu meets WCAG 2.2 AA', async ({ page }) => {
  await page.goto('/#x');
  await page.getByRole('button', { name: 'Rooms' }).click();
  await expect(page.locator('.menu.on')).toBeVisible();
  await expectAllPicturesLoaded(page);
  await page.waitForTimeout(700);
  await audit(page, { within: '.menu.on' });
});

// One test per room and state rather than one for the lot: WebKit on a CI
// runner draws the rooms slowly (their blurred washes and frosted controls),
// and a single test auditing every room three times ran out of time there.
// The rooms are read from the page, so the slots cover up to six; a slot
// with no room behind it is skipped.
for (let slot = 0; slot < 6; slot++) {
  for (const state of ['label', 'Content menu', 'full screen'] as const) {
    test(`@live room ${slot + 1} with its ${state} meets WCAG 2.2 AA`, async ({ page, isMobile, request }) => {
      test.setTimeout(90_000);
      const room = (await site(request)).filter((r) => r.type !== 'about' && r.works.length)[slot];
      test.skip(!room, 'no room in this slot');
      await open(page, `/#${room.id}/${room.works[0].slug}`);
      await expect(page.locator('.info h2')).toHaveText(room.works[0].title);
      await expectPlateLoaded(page);
      await hover(page);
      if (state === 'label') {
        await audit(page);
      } else if (state === 'Content menu') {
        await page.getByRole('button', { name: 'Content' }).click();
        await expect(page.locator('.menu.on')).toBeVisible();
        await page.waitForTimeout(700);
        await audit(page, { within: '.menu.on' });
      } else {
        // Full screen with its hint, then (with a keyboard) the short title
        // Space brings up.
        await page.locator('.room .rail').click({ position: { x: 200, y: 150 } });
        await expect(page.locator('.room')).toHaveClass(/bare/);
        if (!isMobile) {
          await page.keyboard.press('Space');
          await expect(page.locator('.mini')).toHaveClass(/on/);
        }
        await page.waitForTimeout(900);
        await audit(page);
      }
    });
  }
}

test('@live the About room meets WCAG 2.2 AA', async ({ page, request }) => {
  const about = (await site(request)).find((r) => r.type === 'about');
  test.skip(!about, 'no About room');
  await page.goto(`/?id=${about!.uid}`);
  await expect(page.locator('.aboutroom')).toBeVisible();
  await hover(page);
  await audit(page);
});

for (const path of ['/terms', '/privacy']) {
  test(`@live ${path} meets WCAG 2.2 AA`, async ({ page }) => {
    await page.goto(path);
    await scrollThrough(page);
    await audit(page);
  });
}

test('@live a purchase page of each kind meets WCAG 2.2 AA', async ({ page, request }) => {
  const works = (await site(request)).flatMap((r) => r.works.map((w) => ({ room: r.id, ...w })));
  // One that can be asked about, and one that cannot: the two layouts.
  const picks = [works.find((w) => w.status === 'available'), works.find((w) => w.status !== 'available')].filter(Boolean);
  expect(picks.length).toBeGreaterThan(0);
  for (const w of picks) {
    const res = await page.goto(`/buy/${w!.room}/${w!.slug}`);
    expect(res?.status()).toBe(200);
    await scrollThrough(page);
    await expectAllPicturesLoaded(page);
    await audit(page);
  }
});

test('@live the 404 pages meet WCAG 2.2 AA', async ({ page }) => {
  for (const path of ['/does-not-exist', '/buy/does-not-exist/nothing']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await audit(page);
  }
});

test('@live every picture has a text alternative and every control a name', async ({ page, request }) => {
  const check = () =>
    page.evaluate(() => [
      ...Array.from(document.images)
        .filter((i) => i.getAttribute('alt') === null)
        .map((i) => `img ${i.currentSrc || i.src || i.dataset.src}`),
      ...Array.from(document.querySelectorAll('a, button'))
        .filter((el) => !(el.getAttribute('aria-label') || (el as HTMLElement).textContent || '').trim())
        .map((el) => `${el.tagName.toLowerCase()} ${el.outerHTML.slice(0, 80)}`),
    ]);
  const rooms = await site(request);
  await page.goto('/');
  expect(await check(), 'lobby').toEqual([]);
  const first = rooms.find((r) => r.type !== 'about' && r.works.length)!;
  await open(page, `/#${first.id}/${first.works[0].slug}`);
  await expect(page.locator('.room')).toBeVisible();
  expect(await check(), 'room').toEqual([]);
  for (const path of ['/terms', '/privacy', `/buy/${first.id}/${first.works[0].slug}`]) {
    await page.goto(path);
    expect(await check(), path).toEqual([]);
  }
});
