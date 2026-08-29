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
  await expect(page.locator('.mini')).toContainText('Undertow');
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
  await page.goto('/#dogs');
  await expect(page.locator('.room')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('Made in Texas');
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
  await expect(page.locator('.menu.on .mitem')).toHaveCount(4);
  await page.keyboard.press('Escape');

  await page.locator('.enter').first().click();
  await page.getByRole('button', { name: 'Content' }).click();
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
  await expect(page.locator('.room .rail > .slide').nth(2).locator('.art')).toBeVisible();
});

test('the About room opens onto its hero, with nothing to page through', async ({ page }) => {
  await page.goto('/#about');
  // In the lobby it is a panel like any other, minus a work count.
  await expect(page.locator('.lpanel .cap .n').last()).toHaveText('About');
  await page.locator('.enter').last().click();

  const pane = page.locator('.aboutroom');
  await expect(pane).toBeVisible();
  await expect(page.locator('.abody .n')).toHaveText('Klaus Hofrichter');
  await expect(page.locator('.abody strong')).toHaveText('the dog');

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
  expect(bg).toContain('/assets/about/IMG_2731.jpg');
  // It is a hero, not stock: /health still counts 15 works across the rooms.
  const health = await (await page.request.get('/health')).json();
  expect(health.works).toBe(15);
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
  await page.goto('/#colors/undertow');
  await expect(page.locator('.room .plate .art').first()).toBeVisible();
  await expect.poll(async () => (await plateGeometry(page)).slack).toBeGreaterThan(0);
  const g = await plateGeometry(page);
  expect(g.pictureTop).toBeGreaterThanOrEqual(g.navBottom);
});

test('a picture that fills the height is left centred', async ({ page }) => {
  // Wider than 4:3: the bars are at the sides, so there is nothing to spend.
  await page.setViewportSize({ width: 1600, height: 800 });
  await page.goto('/#colors/undertow');
  await expect(page.locator('.room .plate .art').first()).toBeVisible();
  const g = await plateGeometry(page);
  expect(g.slack).toBeLessThanOrEqual(1);
  expect(g.objectPosition).toBe('');
});

test('full screen re-centres the picture, with the buttons gone', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto('/#colors/undertow');
  await expect.poll(async () => (await plateGeometry(page)).objectPosition).not.toBe('');
  await page.keyboard.press('Enter');
  await expect(page.locator('.room')).toHaveClass(/bare/);
  await expect.poll(async () => (await plateGeometry(page)).objectPosition).toBe('');
});

test('full screen really hides the navigation', async ({ page }) => {
  // The idle-dim rule carries an id, so it used to outrank the rule that
  // hides these — they stayed faintly visible with the pointer outside.
  await page.goto('/#colors/undertow');
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
  await page.goto('/?id=rib3oeuf');
  const scrim = page.locator('.aboutroom .scrim');
  const bg = await scrim.evaluate((n) => getComputedStyle(n).backgroundImage);
  expect(bg).toContain('linear-gradient');
  // opaque where the words are, gone before the right edge
  expect(bg).toMatch(/rgba\(6, 9, 14, 0\.9\d*\)/);
  expect(bg).toContain('rgba(6, 9, 14, 0) 78%');
});

test('a permalink opens the picture it names', async ({ page }) => {
  await page.goto('/?id=bab5q6e3');            // Dogs / Waiting
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('Waiting');
});

test('a permalink to a room opens that room', async ({ page }) => {
  await page.goto('/?id=dyzhyy87');            // Food
  await expect(page.locator('.room')).toBeVisible();
  await expect(page.locator('.info h2')).toHaveText('Romanesco');
});

test('an unknown permalink lands in the lobby without complaint', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('/?id=zzzzzzzz');
  await expect(page.locator('.lpanel .cap .n').first()).toHaveText('Colors');
  await expect(page.locator('.room')).toHaveCount(0);
  expect(errs).toEqual([]);
  await expect(page.locator('body')).not.toContainText('not found', { ignoreCase: true });
});

test('the label carries a permalink icon pointing at the id', async ({ page }) => {
  await page.goto('/#colors/undertow');
  const link = page.locator('.info .permalink');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /\?id=leyb1brb$/);
});

test('the ?id= does not linger and hijack a later share', async ({ page }) => {
  await page.goto('/?id=leyb1brb');                 // Colors / Undertow
  await expect(page.locator('.info h2')).toHaveText('Undertow');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.info h2')).toHaveText('Shallows');
  // Whatever is in the address bar now must reopen what is on screen.
  expect(page.url()).not.toContain('id=');
  await page.goto(page.url());
  await expect(page.locator('.info h2')).toHaveText('Shallows');
});

test('a permalink to the About room opens it', async ({ page }) => {
  await page.goto('/?id=rib3oeuf');
  await expect(page.locator('.aboutroom')).toBeVisible();
});

test('a malformed hash does not blank the page', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('/#100%');
  await expect(page.locator('.lpanel').first()).toBeAttached();
  await expect(page.locator('.lpanel .cap .n').first()).toHaveText('Colors');
  expect(errs).toEqual([]);
});

test('the label offers the picture on screen at full resolution', async ({ page }) => {
  await page.goto('/#colors/undertow');
  const dl = page.locator('.info .download');
  await expect(dl).toBeVisible();
  await expect(dl).toHaveAttribute('href', '/assets/colors/IMG_7281.jpg');
  await expect(dl).toHaveAttribute('download', 'undertow.jpg');

  // it follows the picture, and there is only ever one
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.info h2')).toHaveText('Shallows');
  await expect(page.locator('.info .download')).toHaveCount(1);
  await expect(page.locator('.info .download')).toHaveAttribute('download', 'shallows.jpg');
});

test('the download really serves the full-resolution original', async ({ page }) => {
  await page.goto('/#colors/undertow');
  const href = await page.locator('.info .download').getAttribute('href');
  const res = await page.request.get(href as string);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/jpeg');
  // the original on disk is ~1.2MB; the room view does not downscale
  expect(Number(res.headers()['content-length'])).toBeGreaterThan(1_000_000);
});

test('the About room offers no download', async ({ page }) => {
  await page.goto('/?id=rib3oeuf');
  await expect(page.locator('.aboutroom')).toBeVisible();
  await expect(page.locator('.download')).toHaveCount(0);
});

test('a print says what a buyer gets that a download does not', async ({ page }) => {
  await page.goto('/#food/romanesco');
  const inc = page.locator('.info dd.includes');
  await expect(inc).toContainText('Personally signed by the artist');
  await expect(inc).toContainText('Comes with the recipe and cooking instructions');

  // dogs are signed but come with no recipe
  await page.goto('/?n=2#dogs/waiting');
  await expect(page.locator('.info dd.includes')).toContainText('Personally signed');
  await expect(page.locator('.info dd.includes')).not.toContainText('recipe');

  // the originals are one of one; there is nothing to add
  await page.goto('/?n=3#colors/undertow');
  await expect(page.locator('.info h2')).toHaveText('Undertow');
  await expect(page.locator('.info dd.includes')).toHaveCount(0);
});

test('an original that is gone shows no price and nothing to promise', async ({ page }) => {
  await page.goto('/#colors/ember');
  await expect(page.locator('.info .status')).toHaveText('Sold');
  await expect(page.locator('.info .price')).toHaveCount(0);
  await expect(page.locator('.info dd.includes')).toHaveCount(0);
});

test('the prints are all still available, because they can be run again', async ({ page }) => {
  for (const room of ['dogs', 'food']) {
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
  await page.goto('/#colors/undertow');
  await expect(page.locator('.room .chrome.c-tr')).toHaveCount(0);
});

test('the menu closes from the foot of its own list', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/#dogs/made-in-texas');
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
  await page.goto('/#colors/undertow');
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
  for (const url of ['/#dogs', '/#colors/undertow', '/?id=leyb1brb']) {
    await page.goto(url);
    await page.waitForTimeout(400);
    await expect(page.locator('.welcome')).toHaveCount(0);
  }
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
