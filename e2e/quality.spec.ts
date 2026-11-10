/**
 * Qualities that are easy to lose without noticing: nothing jumps while a
 * page loads, every picture holds its place before it arrives, a phone
 * fetches no more than it needs, nothing errors along the way, and the
 * gallery is still a readable index without JavaScript.
 */
import { test, expect, site, open, LIVE, manifest, watchProblems, reportCspViolations, scrollThrough, expectAllPicturesLoaded, expectCoversLoaded, expectPlateLoaded, frontPicture } from './helpers';
import type { Page } from '@playwright/test';

async function trackLayoutShift(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

test('@live nothing jumps while the lobby, a room or a purchase page loads (layout shift)', async ({ page }) => {
  await trackLayoutShift(page);
  await page.goto('/');
  const rooms = await manifest(page);
  await expectCoversLoaded(page, await page.locator('.lpanel:not(.nocover)').count());
  const room = rooms.find((r) => r.type !== 'about' && r.works.length)!;
  const work = room.works.find((w) => w.views?.length) ?? room.works[0];
  const cls = () => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  // Only Chromium reports layout shifts; elsewhere this reads 0, which is why
  // the next test exists.
  expect(await cls(), '/').toBeLessThan(0.02);

  await page.goto(`/?id=${work.uid}`);
  await expectPlateLoaded(page);
  expect(await cls(), 'a room').toBeLessThan(0.02);

  await page.goto(`/buy/${room.id}/${work.slug}`);
  await scrollThrough(page);
  await expectAllPicturesLoaded(page);
  expect(await cls(), 'a purchase page').toBeLessThan(0.02);
});

test('every picture on a purchase page holds its place before it arrives', async ({ page, request }) => {
  // Hold back every picture, as a slow network would. Each must already take
  // the box it will fill: an unsized picture takes none until it loads (in
  // Firefox and Safari not even a lazy one with width and height, when it is
  // sized `auto` both ways; kube-setup vault, Gotchas), and the text under it
  // jumps down when it lands.
  const rooms = await site(request);
  const room = rooms.find((r) => r.works.some((w) => w.views?.length))!;
  const work = room.works.find((w) => w.views?.length)!;
  await page.route('**/assets/**', () => {});
  await page.goto(`/buy/${room.id}/${work.slug}`, { waitUntil: 'domcontentloaded' });
  const boxes = await page.locator('.buyart, .viewgrid img').evaluateAll((imgs) =>
    imgs.map((img) => {
      const r = img.getBoundingClientRect();
      return { alt: img.getAttribute('alt'), w: r.width, h: r.height, aspect: Number(img.getAttribute('width')) / Number(img.getAttribute('height')) };
    }),
  );
  expect(boxes.length).toBeGreaterThan(1);
  for (const b of boxes) {
    expect(b.h, `${b.alt}: no height before it loads`).toBeGreaterThan(50);
    expect(b.w / b.h, `${b.alt}: the shape of its picture`).toBeCloseTo(b.aspect, 1);
  }
});

test('a phone fetches small text and pictures sized for its screen', async ({ page, isMobile, request }) => {
  test.skip(!isMobile, 'phone projects only');
  // Pictures at the width the screen needs, never larger: the drawn width
  // times the pixel ratio, rounded up to the next copy that exists. A copy
  // more than twice that would be paying for pixels nobody sees.
  const rooms = (await site(request)).filter((r) => r.type !== 'about' && r.works.length);
  const work = rooms[0].works[0];
  await page.goto(`/?id=${work.uid}`);
  await expectPlateLoaded(page);
  const drawn = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('.room .rail > .slide img.art')!;
    return { url: img.currentSrc, file: img.naturalWidth, need: img.getBoundingClientRect().width * devicePixelRatio };
  });
  const rungs = work.widths ?? [];
  const fits = rungs.find((w) => w >= drawn.need) ?? rungs[rungs.length - 1] ?? drawn.file;
  expect(drawn.file, `${drawn.url} for ${Math.round(drawn.need)}px`).toBeLessThanOrEqual(Math.max(fits, drawn.need * 2));
  expect(await frontPicture(page)).toBeTruthy();
});

test('@live a phone stays within this site\'s byte budget', async ({ page, isMobile, browserName }) => {
  test.skip(!isMobile, 'phone projects only');
  test.skip(browserName !== 'chromium', 'one phone: the bytes are the same, and Chromium reports them');
  // The budget for THIS site, measured on the live gallery on 2026-11-09 with
  // an Android phone (Pixel 7, 412px at 2.6x). Set from what the pictures are
  // displayed at: every cover and every picture fills the whole screen, so
  // each is a 1024 or 1536px copy, and a room fetches all of its pictures
  // one by one as soon as it opens (so paging is instant), each with a
  // blurred 640px wash behind it. About twice today's figures, so a room
  // that doubles or a picture pipeline that stops shrinking copies has to be
  // a decision rather than an accident. In CI the fixtures are a few KB.
  const usage = async () => {
    const entries = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .concat(performance.getEntriesByType('navigation'))
        .map((e) => ({ url: e.name.replace(location.origin, ''), bytes: (e as PerformanceResourceTiming).encodedBodySize })),
    );
    const sum = (f: (u: string) => boolean) => entries.filter((e) => f(e.url)).reduce((n, e) => n + e.bytes, 0);
    return { text: sum((u) => !/^\/(assets|fonts)\/|\.png\?/.test(u)), fonts: sum((u) => u.startsWith('/fonts/')), pictures: sum((u) => u.startsWith('/assets/')) };
  };
  await page.goto('/');
  const rooms = await manifest(page);
  await expectCoversLoaded(page, await page.locator('.lpanel:not(.nocover)').count());
  const lobby = await usage();
  console.log(`lobby on a phone: ${JSON.stringify(lobby)}`);
  expect(lobby.text, 'the page, stylesheet and script, compressed').toBeLessThan(80_000);
  expect(lobby.fonts, 'the three faces above the fold').toBeLessThan(150_000);
  expect(lobby.pictures, 'the lobby covers').toBeLessThan(1_500_000);

  // The largest room, entered, with every picture it queues fetched.
  const largest = rooms.filter((r) => r.type !== 'about' && r.works.length).sort((a, b) => b.works.length - a.works.length)[0];
  await page.goto(`/?id=${largest.uid}`);
  await expect(page.locator('.room')).toBeVisible();
  await expect
    .poll(() => page.locator('.room img.art').evaluateAll((imgs) => imgs.filter((i) => !(i as HTMLImageElement).complete || !(i as HTMLImageElement).naturalWidth).length), { timeout: 60_000 })
    .toBe(0);
  const room = await usage();
  console.log(`${largest.works.length}-picture room on a phone: ${JSON.stringify(room)}`);
  expect(room.pictures / largest.works.length, 'per picture in a room, wash included').toBeLessThan(400_000);
});

test('@live no console errors or CSP violations through a full visit', async ({ page, request }) => {
  const problems = watchProblems(page);
  await reportCspViolations(page);
  const rooms = await site(request);
  const room = rooms.find((r) => r.type !== 'about' && r.works.length)!;
  for (const path of ['/', `/?id=${room.uid}`, `/buy/${room.id}/${room.works[0].slug}`, '/terms', '/privacy']) {
    await page.goto(path);
    await scrollThrough(page);
  }
  expect(problems).toEqual([]);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the gallery is still an index of every room and picture, and each holds its place', async ({ page, request }) => {
    // The manifest is in the page as data; read it without running anything.
    const html = await (await request.get('/')).text();
    const rooms = JSON.parse(html.match(/id="manifest">(.*?)<\/script>/s)![1].replace(/\\u003c/g, '<')) as { type: string; title: string; works: unknown[] }[];
    await page.route('**/assets/**', () => {});
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.fallback h1')).toBeVisible();
    await expect(page.locator('.fallback h2')).toHaveText(rooms.map((r) => r.title));
    const pictures = rooms.reduce((n, r) => n + r.works.length, 0);
    await expect(page.locator('.fallback a[href^="/buy/"]')).toHaveCount(pictures);
    const boxes = await page.locator('.fallback img').evaluateAll((imgs) => imgs.map((i) => i.getBoundingClientRect().height));
    for (const h of boxes) expect(h, 'a thumbnail with no height before it loads').toBeGreaterThan(50);
  });
});

test('@live the rate limit counts pages, not the files a page loads', async ({ request }, testInfo) => {
  test.skip(!LIVE, 'locally and in CI the server sees loopback and limits nothing (test/ratelimit.test.ts covers it)');
  test.skip(testInfo.project.name !== 'desktop-chromium', 'once is enough');
  const page = await request.get('/terms');
  expect(page.headers()['ratelimit-limit']).toBe('300');
  const before = Number(page.headers()['ratelimit-remaining']);
  // The stylesheet the page names, and the favicon: no budget spent, no
  // headers at all.
  const html = await page.text();
  for (const m of html.matchAll(/href="(\/[^"/]+\.(?:css|png)\?v=[^"]+)"/g)) {
    const file = await request.get(m[1]);
    expect(file.status(), m[1]).toBe(200);
    expect(file.headers()['ratelimit-remaining'], m[1]).toBeUndefined();
  }
  const again = await request.get('/terms');
  // Exactly one less, unless the window turned over in between.
  const after = Number(again.headers()['ratelimit-remaining']);
  expect(after === before - 1 || after >= 298, `${before} then ${after}`).toBe(true);
});
