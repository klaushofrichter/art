# art.klaushofrichter.net

[![Release](https://img.shields.io/github/v/release/klaushofrichter/art?label=release&color=blue)](https://github.com/klaushofrichter/art/releases)
[![PR checks](https://github.com/klaushofrichter/art/actions/workflows/production-checks.yml/badge.svg)](https://github.com/klaushofrichter/art/actions/workflows/production-checks.yml)
[![Build and publish image](https://github.com/klaushofrichter/art/actions/workflows/build-push.yml/badge.svg)](https://github.com/klaushofrichter/art/actions/workflows/build-push.yml)
[![Deploy production](https://github.com/klaushofrichter/art/actions/workflows/deploy-production.yml/badge.svg)](https://github.com/klaushofrichter/art/actions/workflows/deploy-production.yml)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-025E8C?logo=dependabot&logoColor=white)](https://github.com/klaushofrichter/art/security/dependabot)

<!-- The release badge tracks the newest tag, which a successful production
     deploy cuts (see "Versioning and releases"). It is the last *released*
     version, not necessarily the running one: a deploy that rolls out and then
     fails its smoke test leaves production ahead of the tag. GET /health is
     what reports the running version.

     The three workflow badges are live status. The Dependabot one is static —
     GitHub publishes no endpoint for alert status on a repo, so it asserts
     that alerts, security updates, and .github/dependabot.yml are all in place
     rather than checking them. If Dependabot is ever turned off, this badge
     will not notice. -->

A gallery of paintings and photographs, served at
[art.klaushofrichter.net](https://art.klaushofrichter.net).

Public — no login, no accounts, nothing to sign into. An Express/TypeScript
app that reads its content from the picture folders at boot and runs as a
[Knative](https://knative.dev/) Service on a self-hosted single-node k3s
cluster (see [`klaushofrichter/kube-setup`](https://github.com/klaushofrichter/kube-setup)).

---

## How it works

### The lobby

Full-height panels, one per room, moved by drag, wheel or arrow keys. A room's
cover is cropped and drifts against the pointer under a soft white light —
both driven by springs on an animation-frame loop rather than CSS transitions,
which is what keeps the motion smooth rather than choppy.

Entering a room is deliberate: the **Enter the room** button, the side menu, or
`Return`. Clicking a panel does nothing.

### A room

Each picture takes the whole screen — contained so nothing is ever clipped, but
scaled up when the source is smaller so there is no dead space. When a
picture's shape leaves a bar above and below it, that slack drops the picture
clear of the navigation buttons rather than centring it behind them.

The full label shows by default; a click anywhere — or `Return` — clears it for
an unobstructed picture, and a click, `Return` or `Esc` brings it back.

Navigation always sits in the same place: a stack at the top left. In the lobby
that is **Rooms**; in a room it is **← Lobby** with **Content** underneath.
The rooms menu is headed **Lobby**, and that heading is itself the way back to
the front door — out of any room, onto the first panel, with the greeting
played again.
The tree is strict — a room's menu lists that room's pictures and offers no way
sideways to another room.

Someone arriving at the bare front door — no fragment, no permalink — is met
by a title card that names the gallery, holds for a few seconds and fades. The
room's own caption waits until it has gone rather than sitting behind it. Any
click, tap, key or scroll dismisses it at once, and it ignores the pointer, so
it is never in the way. A visitor who followed a deep link or a permalink
already knows where they are going and is not greeted.

The lobby also carries a full-screen control at the top right — the browser's
own full screen, so the gallery fills the window and stays that way as you move
through it. It is the one control that is not navigation, which is why it sits
opposite the stack rather than in it.

### The About room

A room with no works: one hero image and the artist's text. Because there is
one picture and nothing to sell, it is not built like a picture room — no
paging, no thumbnails, no full screen. The only navigation is leaving it.

The hero fills the frame without bars and keeps its ratio, pinned by its top
right corner to the window's, so the crop is taken from the bottom left. It is
shown as it is: none of the lobby's pointer light, drift or dimming follows it
into the room, because no other room has those either. The text is carried by a
band that fades away to the right instead.

### Keys

| Key | |
| --- | --- |
| `↑` `↓` | previous / next |
| drag, wheel | the same, with a throw |
| `Return` | in the lobby, enter the room you are looking at; in a room, in and out of full screen |
| `Space` | short label — title and date. Full screen only, where there is no full label for it to collide with |
| `R` | rooms (in the lobby) |
| `P` | content of the room you are in |
| `Esc` | back one level: menu → full screen → room → lobby |

### Links

| Form | Goes to |
| --- | --- |
| `/#dogs` | the lobby, on that room |
| `/#dogs/close` | straight to one picture |
| `/?id=bab5q6e3` | permalink — a room or a picture, by its own id |

A permalink is the id from `index.json`, not a position or a title, so it
survives renaming and reordering. An id that no longer exists lands quietly in
the lobby; there is no error page, because there is nothing useful to say.

A picture's label carries two icons: its permalink, and a download of that
picture at full resolution. The download is always the one picture on screen —
there is no way to pull a whole room, by design.

---

## Content

**The pictures are not in this repository.** It is public and the artwork is
not; the gallery reads its content from a directory given by `ASSETS_DIR`,
which in production is a Kubernetes volume. `assets/` is git-ignored, so a
fresh clone has no content until you fetch some:

```bash
scripts/pull-assets.sh          # copy what is live down into ./assets
# …edit…
scripts/sync-assets.sh          # push it back; the site follows within ~10s
```

`sync-assets.sh` validates before it touches the cluster, swaps the new tree
in atomically, and keeps the previous one as `assets.old` for a one-command
rollback. Content ships this way rather than through CI: code goes through
pull requests and checks, content does not.

The layout is one folder per room, each with an `index.json` beside its
pictures.

```jsonc
{
  "collection": {
    "id": "colors",              // must match the folder name
    "uid": "8ul97ls7",           // permalink id, never change it
    "title": "Colors",
    "subtitle": "Acrylic on canvas",
    "description": "Small framed abstracts. Each is **one of one**.",
    "cover": "IMG_7281.jpg",     // fronts the room in the lobby
    "order": 1                   // position in the lobby
  },
  "works": [
    {
      "file": "IMG_7281.jpg",    // the only link between JSON and image
      "uid": "leyb1brb",         // permalink id, never change it
      "title": "Undertow",
      "date": "2024-03",         // YYYY-MM or YYYY-MM-DD; shown as "March 2024"
      "artist": "Klaus Hofrichter",
      "medium": "Acrylic on canvas, gilt frame",
      "dimensions": "10 × 8 in",
      "description": "Worked *wet into wet*…",
      "price": 340,
      "currency": "USD",
      "status": "available",
      "purchase_url": "/buy/colors/undertow"   // optional, see below
    }
  ]
}
```

### What a purchase includes

The pictures are on the site, and the label offers the full-resolution file, so
a download is not what someone pays for. `includes` says what is — signing,
extras, anything a file cannot carry:

```jsonc
"collection": {
  "includes": [
    "Personally signed by the artist",
    "Comes with the recipe and cooking instructions"
  ]
}
```

It sits on the collection and applies to every work in it; a work may add its
own with the same key, and the two are merged. It is shown only where the work
can still be bought, because it reads as a promise rather than a description.
The original paintings carry none — being one of one is the difference.

### Sale status

| `status` | Shown |
| --- | --- |
| `available` | price, and a link to the purchase page |
| `sold` | no price at all — the picture still hangs |
| `reserved` | price shown, but it cannot be bought |
| `nfs` | never for sale |

A sold or not-for-sale price is not merely hidden in the page: it is never sent
to the browser.

### Description markup

A deliberately small subset — `*italic*` and `**bold**`, nothing else. Text is
escaped before the markup is applied, so a stray `<` stays text. Everything the
browser renders is built as DOM nodes rather than HTML strings, so content
cannot become markup.

### Adding things

- **A picture** — drop the file in the folder and add a block to `works`, with
  a fresh 8-character `uid`.
- **A room** — a new folder with its own `index.json`.
- **The About room** — `"type": "about"`, a `body` array of paragraphs, a
  `contact`, and a `cover` used as its hero.

Content ships inside the container image, so changing it means a commit and a
redeploy. There is no database and nothing to back up separately. A picture
listed but missing on disk is skipped with a warning; a malformed `index.json`
throws, so the container fails its readiness probe rather than serving a
half-built gallery.

---

## Running it locally

```bash
npm ci
npm run dev          # http://localhost:8080
```

| Command | |
| --- | --- |
| `npm run build` | compile TypeScript into `dist/` |
| `npm start` | run the compiled server |
| `npm test` | unit tests (vitest + supertest) |
| `npm run test:e2e` | Playwright, against a running server |

| `npm run dev:fixtures` | the same, against the test fixtures |

Configuration is an optional `PORT` (default `8080`), an optional
`ASSETS_DIR` (default `./assets`), and `CONTENT_WATCH_MS` (default `10000`,
`0` to switch it off). The server re-reads its content when the directory
changes, so editing a title or dropping in a picture needs no restart — and
if the new content will not parse, it logs why and keeps serving what it
already had.

### Tests own their content

The suites run against `test/fixtures/assets` — three rooms of solid-colour
images with hand-written metadata, chosen to exercise the cases rather than to
look like art: a landscape, a portrait, a square, one deliberately low-resolution
file, a sold work, a reserved one, one that is not for sale, a room that
promises something with a purchase, and a room with no works at all.

Nothing in the suite refers to the gallery's real content, so changing a price
or a title can never fail a build, and the fixtures are safe to publish.

## Endpoints

- `GET /` — the gallery (`?id=` resolves a permalink)
- `GET /buy/:room/:slug` — a single-picture purchase page
- `GET /terms`, `GET /privacy` — the two documents a payment processor asks for
- `GET /health` — `{"status":"ok","service":"art","version":"…","rooms":4,"works":15}`
- `GET /assets/*` — the pictures

### Speed

Two things matter and both are invisible: the text is gzipped (`compression`
in `src/app.ts`), and the typefaces are served from `public/fonts/` rather
than fetched from Google Fonts. That request was render-blocking on a third
origin — about 1.4s before a font file even started — and it disclosed every
visitor's IP to Google, which the privacy policy then had to admit. The faces
are the same, latin subset only; `public/fonts/LICENSE.md` records the
licences.

The small uppercase mono labels are deliberately below Lighthouse's 12px
threshold. That is the design, and the audit is a blunt instrument: contrast
and tap targets both pass, and accessibility scores 100.

### Pictures are sized for the screen asking

A phone was being sent a 3000px original to show in a 400px frame.
`scripts/make-derivatives.sh` writes smaller copies beside each picture — one
directory per width, keeping the filename:

```
assets/colors/IMG_7281.jpg          the original, untouched
assets/colors/w640/IMG_7281.jpg     …and the copies
assets/colors/w1024/IMG_7281.jpg
assets/colors/w1536/…  w2048/…  w2560/…
```

It runs from `sync-assets.sh`, before anything is uploaded — content is not
part of a deploy any more, so that is the equivalent moment. Copies at or
above a picture's own width are never made, so a small picture simply has
none and is served whole.

The server records which widths exist (`Work.widths`) and the manifest ships
those **numbers**; the browser builds the path itself, the same rule that
keeps a hand-edited `index.json` from putting `javascript:` behind an image.
Real `<img>` elements get a `srcset` and let the browser choose; CSS
backgrounds are picked in JavaScript, where `devicePixelRatio` is known.

Two rules are worth keeping:

- **The top of the ladder is the ceiling for anything on screen.** A display
  wanting more than 2560px gets the 2560 copy, not the original: past that the
  extra pixels are invisible on a photograph and cost half again as many bytes.
- **The original is what the download link serves**, always, at full
  resolution. There is a test for it.

The ambient wash behind a picture is blurred past recognition, so it always
takes the smallest copy no matter the screen. Menu thumbnails are 62px and
take the smallest too — they used to load full-resolution originals.

Roughly, for the lobby: 3960KB before, 964KB on a phone, 1563KB on a tablet,
2239KB on a 2x laptop.

### Link previews

Every page carries Open Graph tags, so a link pasted into a chat or a social
post shows the picture rather than a bare URL. `og:image` is absolute — a
crawler has no page to resolve a relative URL against — and carries
`og:image:width`/`height` so a card can be laid out before the image arrives.
Those dimensions are read from each file's header at content load
(`src/imagesize.ts`, JPEG and PNG); there is no image library in this project
and no reason to add one for four numbers.

The interesting case is `?id=`. The gallery is a single page for the whole
site and the browser resolves the permalink itself — but a crawler runs no
JavaScript, so without help every shared picture would preview as the same
generic gallery card. The server therefore resolves `?id=` too and serves a
variant whose *only* difference is the head; `src/views/shares.ts` pre-renders
one per permalink when the content loads, about twenty copies of a 12KB page.
An unknown id falls back to the gallery and points `og:url` at `/`, so a
mistyped link is not indexed as a page of its own.

`scripts/check-assets.ts` warns about a picture over 5MB or under 200px on its
short side — both make a crawler drop the preview image. Warnings, not errors:
such a picture is still worth showing.

### Terms and privacy

Both live in `src/legal.ts` as data, not markup, so the two pages render the
same way and the facts sit beside the constants they have to agree with — the
enquiry window, for instance, is read from `ENQUIRY_HOURS` rather than typed
out again. Edit the text there and change the `UPDATED` date with it.

They are rendered once at startup: nothing on the content volume can change
them. Tests assert the claims that the code has to keep true — that no page
sets a cookie, that Google Fonts is disclosed because the pages really do
request it, and that no page anywhere asks for a card number.

---

## How it is built

```
$ASSETS_DIR/<room>/        content, from a volume — not from the image
public/app.css, app.js     the gallery itself, served as static files
src/content.ts             loads and validates the folders
src/views/                 server-rendered shell, purchase page
```

The browser gets a manifest of **identifiers, not URLs** — a filename and a
slug — and builds every `src` and `href` from a fixed prefix plus
`encodeURIComponent`, so no `index.json` can put a `javascript:` URL behind a
link.

`public/app.css` and `public/app.js` are served immutable for a year, so their
URLs carry a content hash; without it a deploy would never reach a returning
visitor.

The pages themselves are `Cache-Control: no-cache` — cached, but revalidated
every time, which the ETag makes a 304 with no body. A page names the
fingerprinted assets it needs, so serving a stale one would point at stale
immutable assets and strand the visitor on an old build with no way to reload
out of it. Safari on iOS is the browser most likely to try.

### Motion

Everything the pointer or a drag moves is a spring stepped once per
`requestAnimationFrame`. A CSS transition on a value that pointer events
already rewrite every frame is what makes an interface like this feel choppy.
Tuning constants are at the top of `public/app.js`.

### Loading

Pictures are fetched one at a time, nearest first, so the one on screen is not
sharing the connection with the ones behind it. On a 5 Mbps connection that
takes the first cover from ~6.8s to ~2.6s. The no-JavaScript fallback lives in
a `<noscript>`, so a normal visit never requests it — it used to pull every
picture in the gallery on first load. The gallery is small by design (tens of
pictures), so a simple queue is enough.

---

## Branches and deployment

- **`main`** — development, unprotected. A push builds and pushes
  `ghcr.io/klaushofrichter/art:latest` and `:<sha>`, but does not deploy.
- **`production`** — protected, PR-only from `main`, with `test` and `codeql`
  as required checks. Merging deploys via an in-cluster self-hosted runner and
  cuts a release.

Versions are generated at deploy time as `vYYYY.MM.DD.N` and baked in as
`APP_VERSION`; `package.json` carries no version. The running build is shown at
the bottom of the About room, linked to this repository.

---

## Open items

**Payment is not implemented.** `/buy/<room>/<slug>` is a real page showing the
picture, its details and its price, but the only way to buy is an email
enquiry — there is no cart, no checkout, no payment provider and no order
record. The enquiry opens a mail client with the picture named, a request to
hold it for 48 hours, and its permalink, so a reply can be about one specific
work.

Sending one marks that picture **Sale pending** — but only in the sender's own
browser. There is no server-side state to write to: the status in
`index.json` is baked into the image. A second visitor still sees the picture
as available, and two people can both enquire. It is a reminder to the person
who asked, not a reservation, and it clears itself after the same 48 hours the
email asks for. A real hold needs the persistence that arrives with payment. Deciding that is the next piece of work. The intent is one picture at a
time rather than a basket, so the options are roughly: a payment link per
picture (Stripe Payment Links or similar, no server state), a hosted checkout
session (needs a secret and a webhook to mark a picture sold), or keeping the
enquiry-and-invoice flow as it is. Whichever is chosen, `status` in
`index.json` stays the source of truth for what is still for sale, and marking
something sold remains a commit and a redeploy.

Also open:

- **Image sizes.** The pictures are full-resolution originals, ~1 MB each.
  Generating web-sized derivatives at build time would cut first load
  substantially — it is the single biggest remaining win.
- **One low-resolution source.** `assets/food/IMG_8275.jpg` is 269 × 202 and
  visibly soft now that pictures scale up; it wants re-exporting.
- **Placeholder metadata.** Titles, dates and prices are invented and want
  replacing with real ones.
- **No analytics or error reporting**, deliberately, so nothing is known about
  how the site is used.

## License

[MIT](LICENSE)
