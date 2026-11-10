/**
 * The public site, walked as a visitor walks it, in four browsers: the lobby,
 * every room and every picture in it (each photograph of a work included),
 * the About room, the purchase pages, the legal pages and the 404, with
 * every link followed. Tests tagged @live are read-only (GET only, no
 * sign-in exists) and run twice: before a release against the image the
 * release will ship (production-checks.yml), and after it against
 * https://art.klaushofrichter.net (live-check.yml).
 *
 * What to expect is read from the page's own manifest, never from a list
 * here: CI serves the test fixtures and the live site the real pictures.
 * The behavioural detail (springs, keys, menus, permalinks) is in
 * smoke.spec.ts.
 */
import { Page, Locator } from '@playwright/test';
import {
  test, expect, site, open, LIVE, manifest, Room, watchProblems, reportCspViolations, scrollThrough,
  expectAllPicturesLoaded, expectCoversLoaded, expectPlateLoaded, frontPicture,
} from './helpers';

/** Set by the workflows to the version the server must report. */
const EXPECT_VERSION = process.env.EXPECT_VERSION;

async function press(isMobile: boolean, locator: Locator) {
  if (isMobile) await locator.tap();
  else await locator.click();
}

/** On the live site one browser follows every link: the purchase pages are
 *  fetched as documents, the same in every browser, and each is a page
 *  against the rate limit (300 pages per five minutes per address). */
function crawls(projectName: string) {
  return !LIVE || projectName === 'desktop-chromium';
}

test('@live /health is ok and names the release the About room shows', async ({ page, request }) => {
  const res = await request.get('/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('ok');
  expect(body.service).toBe('art');
  expect(body.rooms).toBeGreaterThan(0);
  expect(body.works).toBeGreaterThan(0);
  if (EXPECT_VERSION) expect(body.version).toBe(EXPECT_VERSION);
  const about = (await site(request)).find((r) => r.type === 'about');
  test.skip(!about, 'no About room to show it');
  await page.goto(`/?id=${about!.uid}`);
  await expect(page.locator('.abody .ver')).toHaveText(`Version ${body.version}`);
  await expect(page.locator('meta[name="generator"]')).toHaveAttribute('content', `art v${body.version}`);
});

test('@live the lobby opens with every room and its cover', async ({ page }) => {
  const problems = watchProblems(page);
  await reportCspViolations(page);
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle('Art — Klaus Hofrichter');
  const rooms = await manifest(page);
  await expect(page.locator('.lpanel .cap .n')).toHaveText(rooms.map((r) => r.title));
  await expect(page.locator('.welcome')).toBeVisible();
  // Every cover is fetched on its own, nearest first, without paging there.
  await expectCoversLoaded(page, await page.locator('.lpanel:not(.nocover)').count());
  expect(problems).toEqual([]);
});

/** Into a room from the lobby: to its panel, then its Enter button. */
async function enter(page: Page, isMobile: boolean, rooms: Room[], room: Room) {
  await open(page, `/#${room.id}`);
  const i = rooms.findIndex((r) => r.id === room.id);
  const button = page.locator('.lpanel .enter').nth(i);
  await expect(button).toBeInViewport();
  await press(isMobile, button);
}

/** The picture in front, and that it is the work and photograph expected. */
async function expectShowing(page: Page, title: string, file: string) {
  await expect(page.locator('.info h2')).toHaveText(title);
  await expectPlateLoaded(page);
  const base = file.replace(/\.[^.]+$/, '');
  const src = (await frontPicture(page))?.src ?? '';
  expect(decodeURIComponent(src), title).toContain(`/${base}.`);
}

test('@live every room, every picture and every photograph of it', async ({ page, isMobile, request }) => {
  test.setTimeout(LIVE ? 240_000 : 90_000);
  const problems = watchProblems(page);
  await reportCspViolations(page);
  const rooms = (await site(request)).filter((r) => r.type !== 'about' && r.works.length);
  for (const room of rooms) {
    await enter(page, isMobile, await site(request), room);
    await expect(page.locator('.room')).toBeVisible();
    for (const [i, w] of room.works.entries()) {
      if (i > 0) {
        // A keyboard steps down the rail; a phone picks from the Content
        // menu, which is the one way across a room that needs no swipe.
        if (isMobile) {
          await page.getByRole('button', { name: 'Content' }).tap();
          await page.locator('.menu.on .mitem').nth(i).tap();
          await expect(page.locator('.menu.on')).toHaveCount(0);
        } else {
          await page.keyboard.press('ArrowDown');
        }
      }
      await expectShowing(page, w.title, w.file);
      await expect(page.locator('.count')).toHaveText(new RegExp(`^0?${i + 1} / `));
      // What the label offers: the purchase page for what can be bought, a
      // permalink, and the original for download.
      if (w.status === 'available') {
        await expect(page.locator('.info .buy')).toHaveAttribute('href', `/buy/${room.id}/${w.slug}`);
      }
      await expect(page.locator('.info .permalink')).toHaveAttribute('href', new RegExp(`\\?id=${w.uid}$`));
      const dl = await page.locator('.info .download').getAttribute('href');
      expect(decodeURIComponent(dl ?? ''), w.title).toContain(`/assets/${room.id}/${w.file}?v=`);
      // The further photographs of this work, each one decoded.
      for (const [n, v] of (w.views ?? []).entries()) {
        await press(isMobile, page.locator('.viewnav.next'));
        await expect(page.locator('.viewcap')).toContainText(`${n + 2} / ${(w.views ?? []).length + 1}`);
        if (v.caption) await expect(page.locator('.viewcap')).toContainText(v.caption);
        await expectShowing(page, w.title, v.file);
      }
    }
    await press(isMobile, page.getByRole('button', { name: '← Lobby' }));
    await expect(page.locator('.room')).toHaveCount(0);
    await expect(page.locator('.lpanel .enter').nth((await site(request)).findIndex((r) => r.id === room.id))).toBeInViewport();
  }
  expect(problems).toEqual([]);
});

test('@live the About room says who, how to write, and links the legal pages', async ({ page, isMobile, request }) => {
  const problems = watchProblems(page);
  const rooms = await site(request);
  const about = rooms.find((r) => r.type === 'about');
  test.skip(!about, 'no About room');
  await enter(page, isMobile, rooms, about!);
  await expect(page.locator('.aboutroom')).toBeVisible();
  await expect(page.locator('.abody a.mail')).toHaveAttribute('href', /^mailto:[^@\s]+@[^@\s]+$/);
  await expect(page.locator('.abody .ver')).toHaveAttribute('href', 'https://github.com/klaushofrichter/art');
  await expect(page.locator('.abody .ver')).toHaveAttribute('rel', /noopener/);
  await press(isMobile, page.locator('.abody .legal a', { hasText: 'Privacy' }));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy Policy');
  // The crumb returns to the About panel the reader came from.
  await press(isMobile, page.locator('.crumb'));
  await expect(page).toHaveURL(/\/#about$/);
  await expect(page.locator('.lpanel.about .enter')).toBeInViewport();
  expect(problems).toEqual([]);
});

test('@live every link on every page goes somewhere that works', async ({ page, context, request, baseURL }, testInfo) => {
  // One browser on the live site: fetched as documents, the pages are the
  // same in all four, and each costs a request against the rate limit.
  test.skip(!crawls(testInfo.project.name), 'one browser follows every link on the live site');
  test.setTimeout(LIVE ? 180_000 : 120_000);
  // Starts at the gallery and follows every same-site link it finds, on every
  // page it reaches, so a page added later is covered without touching this
  // test. The gallery builds its rooms in the browser, so its links come
  // from the no-JavaScript index it carries (every purchase page) and from
  // the manifest (every room and picture a crumb may name). Third-party
  // targets are only checked for shape.
  const origin = new URL(baseURL!).origin;
  await page.goto('/');
  const rooms = await manifest(page);
  const fallback = await page.locator('noscript').first().evaluate((n) => n.textContent ?? '');
  const seeds = [...fallback.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const worksTotal = rooms.reduce((n, r) => n + r.works.length, 0);
  expect(seeds.filter((h) => h.startsWith('/buy/')).length).toBe(worksTotal);

  // On the live site the pages are fetched as documents rather than drawn:
  // the room walk above has already decoded every picture, the links are the
  // same either way, the drawn pages are checked in CI, and one purchase page
  // of each kind is drawn live by a11y.spec.ts.
  const draw = !LIVE;
  const pages = ['/', '/terms', '/privacy', '/does-not-exist', ...seeds.filter((h) => !h.startsWith('mailto:'))];
  const visited = new Set<string>();
  const checked = new Set<string>();
  while (pages.length) {
    const path = pages.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const expected = path === '/does-not-exist' ? 404 : 200;

    let anchors: { href: string; target: string | null; rel: string }[];
    if (draw) {
      const tab = await context.newPage();
      const problems = watchProblems(tab);
      const res = await tab.goto(path);
      // Firefox revalidates a page it has seen in this context: 304 is a 200.
      expect(res?.status() === 304 ? 200 : res?.status(), path).toBe(expected);
      if (path !== '/') {
        await expect(tab.getByRole('heading', { level: 1 }), path).toBeVisible();
        await scrollThrough(tab);
        await expectAllPicturesLoaded(tab);
      }
      expect(problems.filter((p) => !/status of 404/.test(p)), path).toEqual([]);
      anchors = await tab.locator('a[href]').evaluateAll((as) =>
        as.map((a) => ({ href: a.getAttribute('href')!, target: a.getAttribute('target'), rel: a.getAttribute('rel') ?? '' })),
      );
      await tab.close();
    } else {
      const res = await request.get(path);
      expect(res.status(), path).toBe(expected);
      const html = await res.text();
      expect(html, path).toMatch(/<h1[ >]/);
      anchors = [...html.matchAll(/<a\b([^>]*)>/g)].map((m) => ({
        href: (m[1].match(/href="([^"]*)"/) || [])[1]?.replace(/&amp;/g, '&') ?? '',
        target: (m[1].match(/target="([^"]*)"/) || [])[1] ?? null,
        rel: (m[1].match(/rel="([^"]*)"/) || [])[1] ?? '',
      })).filter((a) => a.href);
    }
    if (path !== '/') expect(anchors.length, path).toBeGreaterThan(0);

    for (const { href, target, rel } of anchors) {
      if (href.startsWith('mailto:')) {
        expect(href, path).toMatch(/^mailto:[^@\s?]+@[^@\s?]+(\?|$)/);
        continue;
      }
      const url = new URL(href, origin + path);
      if (url.origin !== origin) {
        if (checked.has(url.href)) continue;
        checked.add(url.href);
        expect(url.protocol, href).toBe('https:');
        if (target === '_blank') expect(rel, href).toContain('noopener');
        continue;
      }
      // The gallery's own deep links: the room, and the picture, must exist.
      if (url.pathname === '/' && url.hash) {
        const [roomId, slug] = decodeURIComponent(url.hash.slice(1)).split('/');
        const room = rooms.find((r) => r.id === roomId);
        expect(room, `${href} on ${path}`).toBeTruthy();
        if (slug) expect(room!.works.map((w) => w.slug), `${href} on ${path}`).toContain(slug);
        continue;
      }
      if (url.pathname.startsWith('/assets/')) {
        if (checked.has(url.pathname) || LIVE) continue;
        checked.add(url.pathname);
        const img = await request.get(url.href);
        expect(img.status(), url.pathname).toBe(200);
        continue;
      }
      if (!visited.has(url.pathname)) pages.push(url.pathname);
    }
  }
  expect(visited.has('/terms') && visited.has('/privacy')).toBe(true);
  expect([...visited].filter((p) => p.startsWith('/buy/')).length).toBe(worksTotal);
});

test('@live an unknown page is a 404 in the site\'s style, with a way back', async ({ page, isMobile }) => {
  const problems = watchProblems(page);
  for (const [path, heading] of [
    ['/does-not-exist', 'Nothing hangs here'],
    ['/buy/does-not-exist/nothing', 'That picture is not here.'],
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page).toHaveTitle('Page not found — Klaus Hofrichter');
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('.legalalso a')).toHaveCount(2);
    await press(isMobile, page.getByRole('link', { name: /Back to the gallery/ }));
    // The lobby writes the panel it shows into the hash.
    await expect(page).toHaveURL(/\/(#[^/]*)?$/);
    await expect(page.locator('.lpanel').first()).toBeVisible();
  }
  // The 404s themselves are expected; Chromium also logs each to the console.
  expect(problems.filter((p) => !/status of 404/.test(p))).toEqual([]);
});

test('@live the legal pages lead to each other and back to the gallery', async ({ page, isMobile }) => {
  const problems = watchProblems(page);
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms of Service');
  await press(isMobile, page.locator('.legalalso a'));
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy Policy');
  await press(isMobile, page.locator('.crumb'));
  await expect(page.locator('.lpanel').first()).toBeVisible();
  expect(problems).toEqual([]);
});

test.describe('keyboard', () => {
  test('Tab reaches every control in the lobby and a room, each with a visible focus ring', async ({ page, isMobile, request }) => {
    test.skip(isMobile, 'no keyboard on a phone');
    const ring = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const s = getComputedStyle(el);
        return { name: el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName, ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 };
      });
    const tabThrough = async () => {
      const focusable = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('a[href], button')).filter((el) => {
          const s = getComputedStyle(el);
          return el.getClientRects().length > 0 && s.visibility !== 'hidden' && !el.closest('[hidden], .menu:not(.on)');
        }).length,
      );
      const seen: string[] = [];
      for (let i = 0; i < focusable; i++) {
        await page.keyboard.press('Tab');
        const f = await ring();
        expect(f.ring, `focus ring on ${f.name}`).toBe(true);
        seen.push(f.name);
      }
      return seen;
    };
    await page.goto('/#x');
    // Firefox and WebKit start Tab from the document only once it has focus.
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    const lobby = await tabThrough();
    expect(lobby).toContain('Rooms');
    expect(lobby.some((n) => /Enter the room|Read more/.test(n))).toBe(true);

    const room = (await site(request)).find((r) => r.type !== 'about' && r.works.length)!;
    await open(page, `/#${room.id}/${room.works[0].slug}`);
    await expect(page.locator('.room')).toBeVisible();
    const inRoom = await tabThrough();
    expect(inRoom).toEqual(expect.arrayContaining(['← Lobby', 'Content']));
  });

  test('the whole gallery can be walked without a pointer', async ({ page, isMobile, request }) => {
    test.skip(isMobile, 'no keyboard on a phone');
    const rooms = (await site(request)).filter((r) => r.type !== 'about' && r.works.length);
    await page.goto('/');
    await page.keyboard.press('Enter');                       // into the first room
    await expect(page.locator('.info h2')).toHaveText(rooms[0].works[0].title);
    await page.keyboard.press('ArrowDown');
    if (rooms[0].works.length > 1) await expect(page.locator('.info h2')).toHaveText(rooms[0].works[1].title);
    await page.keyboard.press('Escape');                      // back to the lobby
    await expect(page.locator('.room')).toHaveCount(0);
    await page.keyboard.press('ArrowDown');                   // the next panel
    await page.keyboard.press('r');                           // the Rooms menu
    await expect(page.locator('.menu.on')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.menu.on')).toHaveCount(0);
  });
});

test.describe('on a phone', () => {
  test('@live a tap clears the label, a swipe turns to the next photograph', async ({ page, isMobile, request }) => {
    test.skip(!isMobile, 'phone projects only');
    const rooms = (await site(request)).filter((r) => r.type !== 'about' && r.works.length);
    const room = rooms.find((r) => r.works.some((w) => w.views?.length)) ?? rooms[0];
    const work = room.works.find((w) => w.views?.length) ?? room.works[0];
    await open(page, `/#${room.id}/${work.slug}`);
    await expectShowing(page, work.title, work.file);
    const size = page.viewportSize()!;
    await page.touchscreen.tap(size.width / 2, size.height * 0.3);
    await expect(page.locator('.room')).toHaveClass(/bare/);
    await expect(page.locator('.backhint .by-touch')).toBeVisible();
    await page.touchscreen.tap(size.width / 2, size.height * 0.3);
    await expect(page.locator('.room')).not.toHaveClass(/bare/);
    if (work.views?.length) {
      // A sideways throw, as a thumb makes it: the pointer events the room
      // listens for, from right to left across the picture.
      const y = size.height * 0.35;
      await page.dispatchEvent('.room', 'pointerdown', { clientX: size.width * 0.8, clientY: y, pointerId: 1, isPrimary: true, pointerType: 'touch' });
      await page.dispatchEvent('.room', 'pointerup', { clientX: size.width * 0.2, clientY: y, pointerId: 1, isPrimary: true, pointerType: 'touch' });
      await expect(page.locator('.viewcap')).toContainText(`2 / ${work.views.length + 1}`);
    }
  });

  test('@live fits without sideways scrolling, on every kind of page', async ({ page, isMobile, request }) => {
    test.skip(!isMobile, 'phone projects only');
    const rooms = await site(request);
    const room = rooms.find((r) => r.type !== 'about' && r.works.length)!;
    for (const path of ['/', '/terms', '/privacy', '/does-not-exist', `/buy/${room.id}/${room.works[0].slug}`]) {
      await page.goto(path);
      await scrollThrough(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
