import { Page, APIRequestContext, expect, test as base } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

// Shared by the public-page specs (site, quality, a11y). Adapted from
// klaushofrichter/www-skylar-technology and www-klaushofrichter (PR #99),
// themselves adapted from klaushofrichter/christina.art, the reference for
// kube-setup's "public web pages" baseline.

/** Set by the workflows when the suite runs against the live site. */
export const LIVE = !!process.env.BASE_URL?.startsWith('https://');

export const test = base;
export { expect };

/** What the page itself was built from: the rooms, their works and views.
 *  The fixtures in CI and the pictures on the live site differ, so every
 *  walk reads what to expect from the page rather than from a list here. */
export type Pic = { file: string; widths?: number[]; caption?: string };
export type Work = Pic & { slug: string; uid: string; title: string; status: string; views?: Pic[] };
export type Room = { id: string; uid: string; type: string; title: string; works: Work[] };

/** The same, read once per worker without opening a page: on the live site
 *  every page load is counted by the rate limit (pictures and the bundle are
 *  not), and most tests only need to know what is there before they go to
 *  it. */
let known: Promise<Room[]> | null = null;
export function site(request: APIRequestContext): Promise<Room[]> {
  known ??= request.get('/').then(async (res) => {
    const html = await res.text();
    return JSON.parse(html.match(/id="manifest">(.*?)<\/script>/s)![1].replace(/\\u003c/g, '<'));
  });
  return known;
}

/** Open a deep link (#room or #room/slug) as a fresh page load, as a visitor
 *  arriving from a shared link does. From a page already on the site, a
 *  change of hash alone loads nothing. */
export async function open(page: Page, path: string): Promise<void> {
  if (page.url() !== 'about:blank') await page.goto('about:blank');
  await page.goto(path);
}

export async function manifest(page: Page): Promise<Room[]> {
  return page.evaluate(() => JSON.parse(document.getElementById('manifest')!.textContent!));
}

/** Console errors, uncaught exceptions, CSP violations and failed same-site
 *  requests seen while a test runs. Walkthroughs end by asserting it is
 *  empty: a page that "works" while the console fills with errors is not
 *  working. A 404 a test asked for on purpose is left out. */
export function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin === new URL(page.url() || r.url()).origin && r.status() >= 400 && !u.pathname.includes('does-not-exist')) {
      problems.push(`HTTP ${r.status()}: ${u.pathname}`);
    }
  });
  page.on('requestfailed', (r) => {
    const failure = r.failure()?.errorText ?? '';
    // A navigation away aborts in-flight pictures, and so does leaving a room
    // while its queue is still loading; neither is a fault.
    if (!/ABORTED|cancelled|NS_BINDING_ABORTED|Load request cancelled/i.test(failure)) problems.push(`failed: ${r.url()} ${failure}`);
  });
  return problems;
}

/** Report CSP violations as console errors, so watchProblems sees them. */
export async function reportCspViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`));
  });
}

/** Scroll the whole page in steps, so lazy pictures load, then return to the
 *  top. The gallery itself does not scroll (it is a fixed screen moved by
 *  springs); the purchase and legal pages do. */
export async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.7));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 120));
    window.scrollTo(0, 0);
  });
}

/** Every <img> the page has asked for has arrived and decoded. An img with
 *  no src yet is one nobody asked for: the menu thumbnails wait in data-src
 *  until the drawer opens, and that is the point of them. WebKit starts a lazy
 *  picture only while it is near the viewport, so each poll brings the first
 *  missing one into view, as a reader stopping there would. */
export async function expectAllPicturesLoaded(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const missing = Array.from(document.images).filter(
            (img) => (img.getAttribute('src') || img.getAttribute('srcset')) && (!img.complete || img.naturalWidth === 0),
          );
          missing[0]?.scrollIntoView({ block: 'center' });
          return missing.map((img) => img.currentSrc || img.src);
        }),
      { timeout: 30_000, message: 'pictures that did not load' },
    )
    .toEqual([]);
}

/** Every lobby cover that has been asked for is painted and really decoded.
 *  The covers are CSS backgrounds, so document.images does not see them. */
export async function expectCoversLoaded(page: Page, count: number): Promise<void> {
  await expect
    .poll(() => page.locator('.lpanel .bg.in').count(), { timeout: 30_000, message: 'covers on screen' })
    .toBe(count);
  const broken = await page.evaluate(async () => {
    const urls = Array.from(document.querySelectorAll<HTMLElement>('.lpanel .bg'))
      .map((b) => (b.style.backgroundImage.match(/url\("(.*)"\)/) || [])[1])
      .filter(Boolean) as string[];
    const out: string[] = [];
    for (const u of urls) {
      const img = new Image();
      img.src = u;
      try { await img.decode(); } catch { out.push(u); }
    }
    return out;
  });
  expect(broken, 'covers that do not decode').toEqual([]);
}

/** The <img> of the picture in front: the slide the room's counter names.
 *  (The slides move on a spring, so their transforms say where they are
 *  going, not which one is meant.) */
export function frontPicture(page: Page) {
  return page.evaluate(() => {
    const n = Number(document.querySelector('.room .count b')?.textContent ?? '1') - 1;
    const img = document.querySelectorAll<HTMLElement>('.room .rail > .slide')[n]?.querySelector<HTMLImageElement>('img.art');
    return img ? { src: img.currentSrc, ok: img.complete && img.naturalWidth > 0 } : null;
  });
}

/** Wait until the room's picture on screen has arrived. */
export async function expectPlateLoaded(page: Page): Promise<void> {
  await expect
    .poll(async () => (await frontPicture(page))?.ok ?? false, { timeout: 30_000, message: 'the picture on screen' })
    .toBe(true);
}

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type AxeNode = { target: unknown[]; failureSummary?: string; any: { data?: unknown }[] };
function describeViolations(violations: { impact?: string | null; id: string; help: string; nodes: { target: unknown[]; failureSummary?: string }[] }[]) {
  return violations.map(
    (v) =>
      `${v.impact} ${v.id}: ${v.help}\n    ${v.nodes
        .slice(0, 6)
        .map((n) => `${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1] ?? ''}`)
        .join('\n    ')}`,
  );
}

/** axe-core, WCAG 2.2 A and AA, zero violations.
 *
 *  Then contrast again, for the text axe could not judge. This gallery puts
 *  its words over photographs, under a scrim that is a gradient, and axe
 *  files every one of those as "incomplete" rather than failing it, while
 *  Lighthouse scores the page 100 (on www-klaushofrichter that hid three real
 *  failures). Swapping a gradient for each of its stops, as the sister sites
 *  do, cannot work here: the photograph under the scrim is part of the
 *  background too, and the stops of a left-to-right veil say nothing about
 *  the one place the words actually sit.
 *
 *  So this measures what is really on screen. For each piece of text axe left
 *  undecided, the text is made transparent, the box it occupies is
 *  photographed, and its colour (with any fading it carries) is held against
 *  the lightest tenth of the pixels behind it (the darkest tenth for dark
 *  text): 4.5:1, or 3:1 for large text. In CI that is the fixtures' flat
 *  colours under the real scrims; on the live site it is the real pictures. */
export async function audit(page: Page, opts: { within?: string } = {}): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(describeViolations(result.violations), 'WCAG 2.2 AA violations').toEqual([]);

  const undecided = result.incomplete
    .filter((r) => r.id === 'color-contrast')
    .flatMap((r) => r.nodes as AxeNode[])
    .map((n) => n.target.join(' '));
  if (!undecided.length) return;
  // With a menu open, the room behind it sits under a dark veil on purpose
  // and is not there to be read; only the menu's own words are measured.

  // What each text is, before it is hidden.
  const texts = await page.evaluate(({ selectors, within }) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
    return selectors.map((sel) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el || (within && !el.closest(within))) return null;
      // Where the words are, not the whole box: a block-level line spans the
      // column even where it has no letters. A pixel in from each edge, so
      // the anti-aliased rim of a button is not taken for its background.
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      const x = Math.max(0, r.left) + 1, y = Math.max(0, r.top) + 1;
      const w = Math.min(window.innerWidth, r.right) - x - 1, h = Math.min(window.innerHeight, r.bottom) - y - 1;
      const s = getComputedStyle(el);
      let opacity = 1;
      for (let n: HTMLElement | null = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
      const [r0, g0, b0, a0 = 1] = parse(s.color);
      const size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700;
      return {
        sel, x, y, w, h, visible: w > 2 && h > 2 && s.visibility !== 'hidden' && opacity > 0,
        color: [r0, g0, b0], alpha: a0 * opacity,
        large: size >= 24 || (bold && size >= 18.66),
      };
    });
  }, { selectors: undecided, within: opts.within });

  await page.addStyleTag({
    content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}',
  });
  // Transitions on colour would otherwise still be running.
  await page.waitForTimeout(400);
  const failures: string[] = [];
  try {
    for (const t of texts) {
      if (!t || !t.visible) continue;
      const shot = await page.screenshot({ clip: { x: t.x, y: t.y, width: t.w, height: t.h }, animations: 'disabled', scale: 'css' });
      const m = await page.evaluate(async ({ b64, color, alpha }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const L = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        // At most about 20,000 pixels, evenly spread: a phone's screenshot of
        // a caption runs to hundreds of thousands, and sorting them all in
        // WebKit took longer than a test is given.
        const stride = Math.max(1, Math.floor(d.length / 4 / 20000));
        const idx: number[] = [];
        const lum: number[] = [];
        for (let i = 0; i < d.length; i += 4 * stride) { idx.push(i); lum.push(L(d[i], d[i + 1], d[i + 2])); }
        const order = idx.map((_, k) => k).sort((a, b) => lum[a] - lum[b]);
        const at = (q: number) => order[Math.min(order.length - 1, Math.floor(order.length * q))];
        // The colour the text is actually drawn in: its own, faded over the
        // middle of what is behind it.
        const mid = idx[at(0.5)];
        const drawn = color.map((v, i) => v * alpha + d[mid + i] * (1 - alpha));
        const lt = L(drawn[0], drawn[1], drawn[2]);
        const light = lt > lum[at(0.5)];
        const k = at(light ? 0.9 : 0.1);
        const lb = lum[k];
        return {
          ratio: (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05),
          bg: [d[idx[k]], d[idx[k] + 1], d[idx[k] + 2]],
        };
      }, { b64: shot.toString('base64'), color: t.color, alpha: t.alpha });
      const need = t.large ? 3 : 4.5;
      if (m.ratio < need) failures.push(`${t.sel}: ${m.ratio.toFixed(2)}:1 against rgb(${m.bg.join(',')}), needs ${need}:1`);
    }
  } finally {
    await page.evaluate(() => document.head.lastElementChild?.remove());
  }
  expect(failures, 'contrast over pictures and gradients, measured on screen').toEqual([]);
}
