import { test, expect } from '@playwright/test';
import { statSync } from 'fs';
import { join } from 'path';

const FIXTURES = join(__dirname, '..', 'test', 'fixtures', 'assets');

test('the lobby opens on the first room', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('.lpanel .cap .n').first()).toHaveText('Shapes');
  await expect(page.locator('.enter').first()).toBeVisible();
});

test('a room opens from the Enter button, and only from it', async ({ page }) => {
  await page.goto('/');
  // Clicking the panel itself must do nothing — entering is deliberate.
  await page.locator('.lpanel').first().click({ position: { x: 700, y: 200 } });
  await expect(page.locator('.room')).toHaveCount(0);

  await page.locator('.enter').first().click();
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('Wide');
});

test('a click clears the label and another brings it back', async ({ page }) => {
  await page.goto('/#shapes');
  await page.locator('.enter').first().click();
  const room = page.locator('.room');
  await expect(room).not.toHaveClass(/bare/);
  await page.locator('.rail').last().click({ position: { x: 400, y: 200 } });
  await expect(room).toHaveClass(/bare/);
  await page.locator('.rail').last().click({ position: { x: 400, y: 200 } });
  await expect(room).not.toHaveClass(/bare/);
});

test('Space does nothing while the full label is up, and works in full screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('.enter').first().click();
  // The full label already carries the title in the same corner, so Space
  // here would print it twice on top of itself.
  await page.keyboard.press('Space');
  await expect(page.locator('.mini')).not.toHaveClass(/on/);

  await page.keyboard.press('Enter');
  await expect(page.locator('.room')).toHaveClass(/bare/);
  await page.keyboard.press('Space');
  await expect(page.locator('.mini')).toHaveClass(/on/);
  await expect(page.locator('.mini')).toContainText('Wide');
  await page.keyboard.press('Space');
  await expect(page.locator('.mini')).not.toHaveClass(/on/);
});

test('Return toggles full screen, and Escape also comes back', async ({ page }) => {
  await page.goto('/');
  await page.locator('.enter').first().click();
  const room = page.locator('.room');
  await page.keyboard.press('Enter');
  await expect(room).toHaveClass(/bare/);
  await page.keyboard.press('Enter');
  await expect(room).not.toHaveClass(/bare/);
  await page.keyboard.press('Enter');
  await expect(room).toHaveClass(/bare/);
  await page.keyboard.press('Escape');
  await expect(room).not.toHaveClass(/bare/);
});

test('leaving full screen puts the short label away with it', async ({ page }) => {
  await page.goto('/');
  await page.locator('.enter').first().click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.locator('.mini')).toHaveClass(/on/);
  await page.keyboard.press('Escape');
  // Otherwise it would sit on top of the full label in the same corner.
  await expect(page.locator('.mini')).not.toHaveClass(/on/);
});

test('the keyboard still works after entering by clicking the button', async ({ page }) => {
  // Chrome leaves focus on the button even once its subtree is hidden, so
  // without moving focus onto the room the shortcuts are dead until you
  // click somewhere else — and Enter re-fires the button instead.
  await page.goto('/');
  await page.locator('.enter').first().click();
  await expect(page.evaluate(() => document.activeElement?.className)).resolves.not.toContain('enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('.room')).toHaveClass(/bare/);
});

test('Return in the lobby enters the room you are looking at', async ({ page }) => {
  await page.goto('/#prints');
  await expect(page.locator('.room')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('First Print');
});

test('both navigation controls sit on the left, one under the other', async ({ page }) => {
  await page.goto('/');
  const lobbyNav = page.locator('.navstack');
  await expect(lobbyNav.locator('.chrome')).toHaveCount(1);

  await page.locator('.enter').first().click();
  const roomNav = page.locator('.room .navstack');
  await expect(roomNav.locator('.chrome')).toHaveCount(2);
  const lobbyBtn = await roomNav.locator('.chrome').first().boundingBox();
  const picsBtn = await roomNav.locator('.chrome').last().boundingBox();
  expect(lobbyBtn!.x).toBeCloseTo(picsBtn!.x, 0);      // same left edge
  expect(picsBtn!.y).toBeGreaterThan(lobbyBtn!.y);      // Content underneath
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
  await expect(page.locator('.menu.on .mitem')).toHaveCount(3);
  await page.keyboard.press('Escape');

  await page.locator('.enter').first().click();
  await page.getByRole('button', { name: 'Content' }).click();
  // Strict tree: this room's three pictures, and no way sideways.
  await expect(page.locator('.menu.on .mitem')).toHaveCount(3);
});

test('a deep link opens straight to one picture', async ({ page }) => {
  await page.goto('/#shapes/square');
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('Square');
});

test('a sold picture shows no price, and still hangs', async ({ page }) => {
  await page.goto('/#shapes/tall');
  await expect(page.locator('.info h2')).toHaveText('Tall');
  await expect(page.locator('.info .status')).toHaveText('Sold');
  await expect(page.locator('.info .price')).toHaveCount(0);
  await expect(page.locator('.room .rail > .slide').nth(2).locator('.art')).toBeVisible();
});

test('the About room opens onto its hero, with nothing to page through', async ({ page }) => {
  await page.goto('/#about');
  // In the lobby it is a panel like any other, minus a work count.
  await expect(page.locator('.lpanel .cap .n').last()).toHaveText('About');
  await page.locator('.enter').last().click();

  const pane = page.locator('.aboutroom');
  await expect(pane).toBeVisible();
  await expect(page.locator('.abody .n')).toHaveText('A Fixture');
  await expect(page.locator('.abody strong')).toHaveText('no works');

  // One picture, so there is nothing to navigate: no rail, no counter, no
  // dots, no Content menu, and no full screen.
  await expect(page.locator('.room .rail')).toHaveCount(0);
  await expect(page.locator('.room .dots')).toHaveCount(0);
  await expect(page.locator('.room .count')).toHaveCount(0);
  await expect(page.locator('.room .navstack .chrome')).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect(page.locator('.room')).not.toHaveClass(/bare/);
});

test('the About hero is shown, and is not one of the works', async ({ page }) => {
  await page.goto('/#about');
  await page.locator('.enter').last().click();
  const bg = await page.locator('.aboutroom .bg').evaluate((n) => getComputedStyle(n).backgroundImage);
  expect(bg).toContain('/assets/about/hero.jpg');
  // It is a hero, not stock: /health still counts 15 works across the rooms.
  const health = await (await page.request.get('/health')).json();
  expect(health.works).toBe(5);
});

test('Escape leaves the About room for the lobby', async ({ page }) => {
  await page.goto('/#about');
  await page.locator('.enter').last().click();
  await expect(page.locator('.aboutroom')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.aboutroom')).toHaveCount(0);
  await expect(page.locator('.lpanel').last()).toBeVisible();
  await expect(page.locator('.lpanel .cap .n').last()).toHaveText('About');
});

// How the picture sits in the frame depends on its shape against the window's,
// so these set a viewport deliberately either side of the pictures' 4:3.
async function plateGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const img = document.querySelector('.room .plate .art') as HTMLImageElement;
    const nav = document.querySelector('.room .navstack') as HTMLElement;
    const boxW = img.offsetWidth, boxH = img.offsetHeight;
    const slack = boxH - img.naturalHeight * Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const pct = parseFloat((img.style.objectPosition || '50% 50%').split(' ')[1]);
    return {
      slack: Math.round(slack),
      navBottom: Math.round(nav.getBoundingClientRect().bottom),
      pictureTop: Math.round(img.offsetTop + slack * (pct / 100)),
      objectPosition: img.style.objectPosition,
    };
  });
}

test('a picture with space above and below sits clear of the navigation', async ({ page }) => {
  // Narrower than the picture's 4:3, so contain leaves a bar top and bottom.
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto('/#shapes/wide');
  await expect(page.locator('.room .plate .art').first()).toBeVisible();
  await expect.poll(async () => (await plateGeometry(page)).slack).toBeGreaterThan(0);
  const g = await plateGeometry(page);
  expect(g.pictureTop).toBeGreaterThanOrEqual(g.navBottom);
});

test('a picture that fills the height is left centred', async ({ page }) => {
  // Wider than 4:3: the bars are at the sides, so there is nothing to spend.
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.goto('/#shapes/wide');
  await expect(page.locator('.room .plate .art').first()).toBeVisible();
  const g = await plateGeometry(page);
  expect(g.slack).toBeLessThanOrEqual(1);
  expect(g.objectPosition).toBe('');
});

test('full screen re-centres the picture, with the buttons gone', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto('/#shapes/wide');
  await expect.poll(async () => (await plateGeometry(page)).objectPosition).not.toBe('');
  await page.keyboard.press('Enter');
  await expect(page.locator('.room')).toHaveClass(/bare/);
  await expect.poll(async () => (await plateGeometry(page)).objectPosition).toBe('');
});

test('full screen really hides the navigation', async ({ page }) => {
  // The idle-dim rule carries an id, so it used to outrank the rule that
  // hides these — they stayed faintly visible with the pointer outside.
  await page.goto('/#shapes/wide');
  await page.keyboard.press('Enter');
  await expect(page.locator('.room')).toHaveClass(/bare/);
  for (const name of ['← Lobby', 'Content']) {
    await expect(page.getByRole('button', { name })).toHaveCSS('opacity', '0');
  }
});

test('the About hero is pinned by its top right and does not react', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/#about');
  await page.locator('.enter').last().click();
  const bg = page.locator('.aboutroom .bg');

  // cover keeps the ratio and leaves no bar; the top right corner of the
  // picture meets the top right corner of the window
  await expect(bg).toHaveCSS('background-size', 'cover');
  await expect(bg).toHaveCSS('background-position', '100% 0px');
  // and none of the lobby's treatment follows it into the room
  await expect(bg).toHaveCSS('filter', 'none');
  await expect(bg).toHaveCSS('transform', 'none');

  await page.mouse.move(1399, 1);
  await page.waitForTimeout(900);
  await expect(bg).toHaveCSS('background-position', '100% 0px');
  await page.mouse.move(1, 799);
  await page.waitForTimeout(900);
  await expect(bg).toHaveCSS('background-position', '100% 0px');
});

test('the About text has something to be read against', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?id=fixabout');
  const scrim = page.locator('.aboutroom .scrim');
  const bg = await scrim.evaluate((n) => getComputedStyle(n).backgroundImage);
  expect(bg).toContain('linear-gradient');
  // opaque where the words are, gone before the right edge
  expect(bg).toMatch(/rgba\(6, 9, 14, 0\.9\d*\)/);
  expect(bg).toContain('rgba(6, 9, 14, 0) 78%');
});

test('a permalink opens the picture it names', async ({ page }) => {
  await page.goto('/?id=fixone01');            // Prints / First Print
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('First Print');
});

test('a permalink to a room opens that room', async ({ page }) => {
  await page.goto('/?id=fixprint');            // Prints
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('First Print');
});

test('an unknown permalink lands in the lobby without complaint', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('/?id=zzzzzzzz');
  await expect(page.locator('.lpanel .cap .n').first()).toHaveText('Shapes');
  await expect(page.locator('.room')).toHaveCount(0);
  expect(errs).toEqual([]);
  await expect(page.locator('body')).not.toContainText('not found', { ignoreCase: true });
});

test('the label carries a permalink icon pointing at the id', async ({ page }) => {
  await page.goto('/#shapes/wide');
  const link = page.locator('.info .permalink');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /\?id=fixwide1$/);
});

test('the ?id= does not linger and hijack a later share', async ({ page }) => {
  await page.goto('/?id=fixwide1');                 // Shapes / Wide
  await expect(page.locator('.info h2')).toHaveText('Wide');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.info h2')).toHaveText('Tall');
  // Whatever is in the address bar now must reopen what is on screen.
  expect(page.url()).not.toContain('id=');
  await page.goto(page.url());
  await expect(page.locator('.info h2')).toHaveText('Tall');
});

test('a permalink to the About room opens it', async ({ page }) => {
  await page.goto('/?id=fixabout');
  await expect(page.locator('.aboutroom')).toBeVisible();
});

test('a malformed hash does not blank the page', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('/#100%');
  await expect(page.locator('.lpanel').first()).toBeAttached();
  await expect(page.locator('.lpanel .cap .n').first()).toHaveText('Shapes');
  expect(errs).toEqual([]);
});

test('the label offers the picture on screen at full resolution', async ({ page }) => {
  await page.goto('/#shapes/wide');
  const dl = page.locator('.info .download');
  await expect(dl).toBeVisible();
  await expect(dl).toHaveAttribute('href', '/assets/shapes/wide.jpg');
  await expect(dl).toHaveAttribute('download', 'wide.jpg');

  // it follows the picture, and there is only ever one
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.info h2')).toHaveText('Tall');
  await expect(page.locator('.info .download')).toHaveCount(1);
  await expect(page.locator('.info .download')).toHaveAttribute('download', 'tall.jpg');
});

test('the download really serves the full-resolution original', async ({ page }) => {
  await page.goto('/#shapes/wide');
  const href = await page.locator('.info .download').getAttribute('href');
  const res = await page.request.get(href as string);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/jpeg');
  // byte-for-byte the file on disk: the room view never downscales what it
  // offers for download
  const onDisk = statSync(join(FIXTURES, 'shapes', 'wide.jpg')).size;
  expect(Number(res.headers()['content-length'])).toBe(onDisk);
});

test('the About room offers no download', async ({ page }) => {
  await page.goto('/?id=fixabout');
  await expect(page.locator('.aboutroom')).toBeVisible();
  await expect(page.locator('.download')).toHaveCount(0);
});

test('a print says what a buyer gets that a download does not', async ({ page }) => {
  await page.goto('/#prints/first-print');
  const inc = page.locator('.info dd.includes');
  await expect(inc).toContainText('Signed by the artist');
  await expect(inc).toContainText('Comes with a note');

  // a room that promises nothing shows nothing
  await page.goto('/?n=3#shapes/wide');
  await expect(page.locator('.info h2')).toHaveText('Wide');
  await expect(page.locator('.info dd.includes')).toHaveCount(0);
});

test('an original that is gone shows no price and nothing to promise', async ({ page }) => {
  await page.goto('/#shapes/tall');
  await expect(page.locator('.info .status')).toHaveText('Sold');
  await expect(page.locator('.info .price')).toHaveCount(0);
  await expect(page.locator('.info dd.includes')).toHaveCount(0);
});

test('the prints are all still available, because they can be run again', async ({ page }) => {
  for (const room of ['prints']) {
    await page.goto(`/?room=${room}#${room}`);
    const statuses = await page.evaluate((id) => {
      const manifest = JSON.parse(document.getElementById('manifest')!.textContent!);
      return manifest.find((r: any) => r.id === id).works.map((w: any) => w.status);
    }, room);
    expect(statuses).not.toContain('sold');
  }
});

test('the About cover holds its right edge, the rooms stay centred', async ({ page }) => {
  // Only matters when the panel is narrower than the picture's 4:3, which is
  // when cover crops left and right rather than top and bottom.
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/#about');
  await expect(page.locator('.lpanel.about .bg')).toHaveCSS('background-position', '100% 50%');
  await expect(page.locator('.lpanel:not(.about) .bg').first())
    .toHaveCSS('background-position', '50% 50%');
});

test('the lobby offers full screen, opposite the navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  const fs = page.locator('.chrome.c-tr.icon');
  await expect(fs).toBeVisible();
  await expect(fs).toHaveAttribute('aria-label', 'Fill the screen');

  // opposite the nav stack: right half, top of the window
  const box = (await fs.boundingBox())!;
  const nav = (await page.locator('.navstack').boundingBox())!;
  expect(box.x).toBeGreaterThan(600);
  expect(box.y).toBeLessThan(120);
  expect(box.x).toBeGreaterThan(nav.x);

  // it really asks the browser, and the icon follows the browser's answer
  await fs.click();
  await expect.poll(async () => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(fs).toHaveAttribute('aria-label', 'Leave full screen');
  await fs.click();
  await expect.poll(async () => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(fs).toHaveAttribute('aria-label', 'Fill the screen');
});

test('a room has nothing in the top right', async ({ page }) => {
  await page.goto('/#shapes/wide');
  await expect(page.locator('.room .chrome.c-tr')).toHaveCount(0);
});

test('the menu closes from the foot of its own list', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/#shapes/wide');
  await page.getByRole('button', { name: 'Content' }).click();
  const menu = page.locator('.menu.on');
  await expect.poll(async () => menu.evaluate((m) => {
    const rows = Array.from(m.querySelectorAll('.mitem'));
    return rows.every((r) => {
      const t = getComputedStyle(r).transform;
      return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
    });
  })).toBe(true);
  const geom = await menu.evaluate((m) => {
    const box = (e: Element) => (e as HTMLElement).getBoundingClientRect();
    const rows = m.querySelectorAll('.mitem');
    return {
      closeX: Math.round(box(m.querySelector('.mclose')!).x),
      closeY: Math.round(box(m.querySelector('.mclose')!).y),
      rowX: Math.round(box(rows[0]).x),
      lastRowBottom: Math.round(box(rows[rows.length - 1]).bottom),
    };
  });
  expect(geom.closeX).toBe(geom.rowX);                     // same left edge as the rows
  expect(geom.closeY).toBeGreaterThan(geom.lastRowBottom); // under the list, not above it
  await menu.locator('.mclose').click();
  await expect(page.locator('.menu.on')).toHaveCount(0);
});

test('the full-screen hint suits the keyboard it is talking to', async ({ page }) => {
  await page.goto('/#shapes/wide');
  await page.keyboard.press('Enter');
  const hint = page.locator('.room .backhint');
  await expect(hint.locator('.by-key')).toBeVisible();
  await expect(hint.locator('.by-touch')).toBeHidden();
});

test('the front door is greeted, and the greeting goes on its own', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.welcome');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Welcome to');
  await expect(card).toContainText('art.klaushofrichter.net');
  // it must never stand between the visitor and the gallery
  await expect(card).toHaveCSS('pointer-events', 'none');
  // and it leaves by itself
  await expect(card).toHaveCount(0, { timeout: 12000 });
  await expect(page.locator('.lpanel .cap').first()).toBeVisible();
});

test('a click sends the greeting away at once', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.welcome')).toBeVisible();
  await page.mouse.click(650, 700);
  await expect(page.locator('.welcome')).toHaveCount(0, { timeout: 4000 });
});

test('a key sends the greeting away at once', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.welcome')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.welcome')).toHaveCount(0, { timeout: 4000 });
});

test('someone who already knows where they are going is not greeted', async ({ page }) => {
  for (const url of ['/#prints', '/#shapes/wide', '/?id=fixwide1']) {
    await page.goto(url);
    await page.waitForTimeout(400);
    await expect(page.locator('.welcome')).toHaveCount(0);
  }
});

test('the rooms menu is titled Lobby and leads back to it', async ({ page }) => {
  // start somewhere that is neither the lobby nor the first room
  await page.goto('/#prints/second-print');
  await expect(page.locator('.info h2')).toHaveText('Second Print');
  await page.keyboard.press('Escape');                 // back to the lobby
  await page.getByRole('button', { name: 'Rooms' }).click();

  const title = page.locator('.menu.on .mtitle');
  await expect(title).toHaveText('Lobby');
  await title.click();

  // the menu closes, the lobby is showing its first room, and the greeting plays
  await expect(page.locator('.menu.on')).toHaveCount(0);
  await expect(page.locator('.welcome')).toBeVisible();
  await expect(page.locator('.welcome')).toContainText('art.klaushofrichter.net');
  await expect.poll(async () => page.evaluate(() => location.hash + location.search)).toBe('');
  await expect(page.locator('.room')).toHaveCount(0);
  await expect(page.locator('.lpanel .cap .n').first()).toHaveText('Shapes');
});

test('going home from inside a room leaves the room', async ({ page }) => {
  await page.goto('/#prints/first-print');
  await expect(page.locator('.room')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Rooms' }).click();
  await page.locator('.menu.on .mtitle').click();
  await expect(page.locator('.room')).toHaveCount(0);
  await expect(page.locator('.welcome')).toBeVisible();
});

test('a room menu keeps its own name and is not a link', async ({ page }) => {
  await page.goto('/#prints/first-print');
  await page.getByRole('button', { name: 'Content' }).click();
  await expect(page.locator('.menu.on')).toContainText('Prints');
  await expect(page.locator('.menu.on .mtitle')).toHaveCount(0);
});

// mailto: would leave the page; the app's own listener still runs.
async function stopMailto(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    document.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest?.('a[href^="mailto:"]');
      if (a) e.preventDefault();
    }, true);
  });
}

test('sending an enquiry marks the picture pending for that visitor', async ({ page }) => {
  await stopMailto(page);
  await page.goto('/buy/shapes/wide');
  await expect(page.locator('.pending-note')).toBeHidden();
  await page.locator('[data-enquire-uid]').click();
  await expect(page.locator('.pending-note')).toBeVisible();

  // and the room says so, with the status itself leading back
  await page.goto('/#shapes/wide');
  const pill = page.locator('.info .status.pending');
  await expect(pill).toHaveText('Sale pending');
  await expect(pill).toHaveAttribute('href', '/buy/shapes/wide');
  await expect(page.locator('.info .price')).toHaveText('$100');
  await expect(page.locator('.info .buy')).toHaveCount(0);
});

test('the mark is only in that browser, never for anyone else', async ({ browser }) => {
  const mine = await browser.newContext();
  const minePage = await mine.newPage();
  await minePage.addInitScript(() => {
    document.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest?.('a[href^="mailto:"]');
      if (a) e.preventDefault();
    }, true);
  });
  await minePage.goto('/buy/shapes/wide');
  await minePage.locator('[data-enquire-uid]').click();
  await minePage.goto('/#shapes/wide');
  await expect(minePage.locator('.info .status.pending')).toBeVisible();

  // someone arriving fresh sees the picture as it really is
  const theirs = await browser.newContext();
  const theirPage = await theirs.newPage();
  await theirPage.goto('/#shapes/wide');
  await expect(theirPage.locator('.info .status.pending')).toHaveCount(0);
  await expect(theirPage.locator('.info .buy')).toBeVisible();
  await mine.close();
  await theirs.close();
});

test('a pending mark lapses after its window', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    // one that expired a minute ago
    localStorage.setItem('art:enquired', JSON.stringify({ fixwide1: Date.now() - 60000 }));
  });
  await page.goto('/?x=1#shapes/wide');
  await expect(page.locator('.info .buy')).toBeVisible();
  await expect(page.locator('.info .status.pending')).toHaveCount(0);
  // and the lapsed entry is cleared out rather than left to accumulate
  const left = await page.evaluate(() => localStorage.getItem('art:enquired'));
  expect(left).toBe('{}');
});

test('the pictures actually load at the URLs the client builds', async ({ page }) => {
  // The browser derives every src from a prefix plus encoded ids rather than
  // taking a URL from the manifest — this is the guard on that construction.
  await page.goto('/#shapes/wide');
  const art = page.locator('.plate .art').first();
  await expect(art).toBeVisible();
  await expect.poll(() => art.evaluate((n: HTMLImageElement) => n.naturalWidth)).toBeGreaterThan(0);
  await expect(art).toHaveAttribute('src', '/assets/shapes/wide.jpg');
});

test('the buy link points at the canonical purchase page', async ({ page }) => {
  await page.goto('/#shapes/wide');
  await expect(page.locator('.info .buy')).toHaveAttribute('href', '/buy/shapes/wide');
});

test('the purchase page is reachable and priced', async ({ page }) => {
  await page.goto('/buy/shapes/wide');
  await expect(page.locator('h1')).toHaveText('Wide');
  await expect(page.locator('.price')).toHaveText('$100');
  await expect(page.locator('.buyside .by')).toContainText('March 2024');
});

test('/health reports the content it loaded', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe('ok');
  expect(body.service).toBe('art');
  expect(body.rooms).toBe(3);
  expect(body.works).toBe(5);
});

/* ---- the terms and the privacy policy ---- */
// Stripe wants both at fixed URLs, so these are ordinary server-rendered
// pages rather than anything the gallery script builds.

test('both legal pages are served, titled, and dated', async ({ page }) => {
  for (const [path, heading] of [
    ['/terms', 'Terms of Service'],
    ['/privacy', 'Privacy Policy'],
  ]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(heading);
    await expect(page.locator('.updated')).toContainText('Last updated');
  }
});

test('the About room links to both, under the version', async ({ page }) => {
  await page.goto('/#about');
  await page.locator('.slide', { hasText: 'About' }).locator('.enter').click();
  const body = page.locator('.abody');
  await expect(body.locator('.ver')).toBeVisible();
  const links = body.locator('.legal a');
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute('href', '/terms');
  await expect(links.nth(1)).toHaveAttribute('href', '/privacy');
  // and the pair sits below the version line, not above it
  const ver = await body.locator('.ver').boundingBox();
  const legal = await body.locator('.legal').boundingBox();
  expect(legal!.y).toBeGreaterThan(ver!.y);
});

test('the links actually go there and lead back', async ({ page }) => {
  await page.goto('/#about');
  await page.locator('.slide', { hasText: 'About' }).locator('.enter').click();
  await page.locator('.abody .legal a', { hasText: 'Terms' }).click();
  await expect(page.locator('h1')).toHaveText('Terms of Service');
  await page.locator('.crumb').click();
  await expect(page.locator('.lpanel').first()).toBeVisible();
});

test('each legal page offers the other one', async ({ page }) => {
  await page.goto('/terms');
  await page.locator('.legalalso a').click();
  await expect(page.locator('h1')).toHaveText('Privacy Policy');
});

test('the legal pages read on a phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 780 });
  for (const path of ['/terms', '/privacy']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('h1')).toBeVisible();
  }
});

test('the favicon is fingerprinted and really loads', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(href).toMatch(/^\/palette\.png\?v=[a-f0-9]{10}$/);
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
