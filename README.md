# art.klaushofrichter.net

A gallery, served at [art.klaushofrichter.net](https://art.klaushofrichter.net).

Public — no login, no accounts, nothing to sign into. An Express/TypeScript
app that reads its content from the picture folders at boot and runs as a
[Knative](https://knative.dev/) Service on a self-hosted single-node k3s
cluster (see [`klaushofrichter/kube-setup`](https://github.com/klaushofrichter/kube-setup)).

## How it works

A **lobby** of full-height panels, one per room, that you drag, scroll or
arrow through. A room's cover is cropped and drifts against the pointer under
a soft white light — both driven by springs on an animation-frame loop rather
than CSS transitions, which is what keeps the motion smooth.

Entering a room is deliberate: the **Enter the room** button, the side menu,
or Enter on the keyboard. Clicking a panel does nothing.

Inside a **room**, each picture takes the whole screen — contained so nothing
is ever clipped, but scaled up when the source is smaller so there is no dead
space. When a picture's shape leaves a bar above and below it, that slack is
spent dropping the picture clear of the navigation buttons rather than
centring it under them; the space collects at the bottom, where the label is. The full label is shown by default; a click anywhere — or `Return` — clears
it for an unobstructed picture, and a click, `Return` or `Esc` brings it back. Navigation is a strict tree: the side menu lists this
room's pictures and offers no way sideways to another room.

Navigation always sits in the same place: a stack at the top left. In the
lobby that is **Rooms**; in a room it is **← Lobby** with **Pictures**
underneath it.

| Key | |
| --- | --- |
| `↑` `↓` | previous / next |
| drag, wheel | the same, with a throw |
| `Return` | in the lobby, enter the room you are looking at; in a room, in and out of full screen |
| `Space` | short label — title and date. Full screen only: with the full label up it would print the title on top of itself |
| `R` | rooms (in the lobby) |
| `P` | pictures (in a room) |
| `Esc` | back one level: menu → full screen → room → lobby |

Deep links work: `#dogs` opens the lobby on that room, `#dogs/close` opens
straight to one picture.

## Content

Everything lives in `assets/`. One folder per room, each with an
`index.json` beside its pictures:

```jsonc
{
  "collection": {
    "id": "colors",              // must match the folder name
    "title": "Colors",
    "subtitle": "Acrylic on canvas",
    "description": "Small framed abstracts. Each is **one of one**.",
    "cover": "IMG_7281.jpg",     // which picture fronts the room
    "order": 1                   // position in the lobby
  },
  "works": [
    {
      "file": "IMG_7281.jpg",    // the only link between JSON and image
      "title": "Undertow",
      "date": "2024-03",         // YYYY-MM or YYYY-MM-DD; shown as "March 2024"
      "artist": "Klaus Hofrichter",
      "medium": "Acrylic on canvas, gilt frame",
      "dimensions": "10 × 8 in",
      "description": "Worked *wet into wet*…",
      "price": 340,
      "currency": "USD",
      "status": "available",
      "purchase_url": "/buy/colors/undertow"   // optional; see below
    }
  ]
}
```

**`status`** decides what is shown:

| | |
| --- | --- |
| `available` | price and a link to the purchase page |
| `sold` | no price at all — the picture still hangs |
| `reserved` | price shown, but it cannot be bought |
| `nfs` | never for sale |

A sold or not-for-sale picture's price is not merely hidden in the page — it
is never sent to the browser.

**`purchase_url`** is optional and is handled entirely on the server: the
gallery always links to `/buy/<room>/<slug>`, and that page redirects if the
JSON points somewhere else. The browser builds every image and link URL from
a fixed prefix and an encoded identifier, and never uses a URL that came from
content — so no `index.json` can put a `javascript:` URL behind a link.

**`description`** takes a deliberately small markup subset: `*italic*` and
`**bold**`, nothing else. Text is escaped before the markup is applied, so a
stray `<` stays text.

**About** is a room with no works: `"type": "about"`, a `body` array of
paragraphs and a `contact`. Its `cover` is a hero image — a picture in the
folder that is not for sale and is not counted as a work. It fronts the panel
in the lobby and fills the room behind the text.

Because there is only one picture and nothing to sell, the About room is not
built like a picture room: no paging, no thumbnails, no full screen. The only
navigation is leaving it, with **← Lobby**, `Esc` or `Return`. Without a
`cover` it falls back to a generated ground.

Adding a picture is a file plus a block of JSON. Adding a room is a folder
with its own `index.json`. Content ships inside the container image, so
changing it means a commit and a redeploy — there is no database and nothing
to back up separately. A picture listed but missing on disk is skipped with a
warning; a malformed `index.json` fails the container's readiness check rather
than serving a half-built gallery.

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

No configuration beyond an optional `PORT` (default `8080`).

## Endpoints

- `GET /` — the gallery
- `GET /buy/:room/:slug` — a single-picture purchase page
- `GET /health` — `{"status":"ok","service":"art","version":"…","rooms":4,"works":15}`
- `GET /assets/*` — the pictures

## Branches and deployment

- **`main`** — development, unprotected. A push builds and pushes
  `ghcr.io/klaushofrichter/art:latest` and `:<sha>`, but does not deploy.
- **`production`** — protected, PR-only from `main`, with `test` and `codeql`
  as required checks. Merging deploys via an in-cluster self-hosted runner and
  cuts a release.

## Versioning

Generated at deploy time as `vYYYY.MM.DD.N` and baked in as `APP_VERSION`.
`package.json` carries no version — the release tags are the only state.

## License

[MIT](LICENSE)
