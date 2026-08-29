# Changelog

Versions are **generated at deploy time**, not carried in the sources: a merge
into `production` is tagged `vYYYY.MM.DD.N`, where `N` counts that day's
releases. Nothing needs bumping and nothing can be forgotten.

Each release's notes are assembled from the commits since the previous one,
preceded by anything curated under Unreleased below. The full history lives on
the [releases page](https://github.com/klaushofrichter/art/releases); this file
is where notes are written *before* a release, not an archive of them.

<!-- Anything written under Unreleased is prepended to the next release's
     notes. Keep prose out of it unless you mean it to be published. -->
## [Unreleased]

- **Terms of Service and a Privacy Policy**, at `/terms` and `/privacy`, linked
  from the About room under the version line. Both are needed to take payments
  through Stripe.

- The favicon is now white on black rather than black on white, and its URL
  carries a content hash like the stylesheet and the script — without one the
  new icon would never reach anyone who had visited before.

- **The pictures have moved out of this repository.** The gallery reads its
  content from a Kubernetes volume, the image no longer carries a copy, and
  `assets/` is git-ignored. Use `scripts/pull-assets.sh` to fetch a working
  copy and `scripts/sync-assets.sh` to publish one; a content change is now a
  sync, not a deploy.

- The favicon moved to `public/palette.png` so that syncing content cannot
  take the site's own icon away.

- The server now notices changed content and reloads it without a restart. A
  change that will not load is refused and the running gallery keeps what it
  has.

- The content directory is now configurable with `ASSETS_DIR`, and the tests
  run against fixtures of their own rather than the gallery's real content.

- The enquiry email now names the picture, asks for a 48-hour hold and carries
  the permalink. Sending one marks the picture **Sale pending** in that
  visitor's own browser, which lapses after the same 48 hours.

- The rooms menu is headed **Lobby** rather than "The Gallery", and the
  heading is now the way back to the front door, greeting included.

- More air between the price and the Buy button in a room's label.

- The About room no longer borrows the lobby's pointer light, drift or
  dimming — no other room has them. Its hero is shown as it is, pinned by its
  top right corner, and the text now sits on a band that fades to the right.

- Arriving at the front door with no fragment or permalink now shows a title
  card naming the gallery, which fades after a few seconds or on any input.

- No print is marked sold any more — a print can be run again, so the word
  was wrong for them. Only the original paintings can be gone.
- The side menu in a room is now **Content** rather than **Pictures**.

- Pages are now `Cache-Control: no-cache`, so a browser always checks for a
  new build instead of deciding for itself. The assets keep their immutable
  year.

- The side menu's Close moved to the foot of its list, aligned with the rows.
- The full-screen hint no longer offers a phone keys it does not have, and
  no longer wraps into something that reads like placeholder text.

- The lobby has a full-screen control at the top right, opposite the
  navigation.

- The About panel's cover is anchored to its right edge in the lobby, so the
  subject stays in frame when the panel is too narrow to show the full width.
  The picture rooms stay centred.

- Prints now say what a buyer gets beyond the file: signed by the artist, and
  for the food pictures, the recipe and cooking instructions. Shown in the
  room label and on the purchase page, and only while the work can be bought.

- A picture's label now offers the full-resolution original for download,
  beside its permalink. Always the one picture on screen; never a whole room.
- Lobby covers are 10% less darkened.

- Fixed from review: a permalink's `?id=` stayed in the address bar after
  navigating, so sharing that URL sent people back to the original picture;
  a permalink to the About room stopped in the lobby instead of opening it;
  a malformed `#` fragment threw and left the page blank; the no-JavaScript
  fallback built links from content rather than from identifiers; and a
  repeated title produced `-2-2-2` rather than counting.

- Permalinks: every room and picture now carries a stable 8-character id, and
  `?id=<uid>` opens it. A picture's label shows the link as an icon. An id that
  no longer exists lands quietly in the lobby.
- The full-screen caption is anchored to the corner of the window and reaches
  under the whole title, instead of floating with a gap around it.
- The About room shows which build is running, linked to the repository.
- The room label's gradient is shorter again.
- First load is much lighter: the no-JavaScript fallback moved into a
  `<noscript>`, so a normal visit no longer requests every picture in the
  gallery, and pictures now load one at a time, nearest first. On a 5 Mbps
  connection the first cover appears in ~2.6s rather than ~6.8s.

- The label's gradient in a room is about a third shorter, so it no longer
  reaches the middle of the picture.
- In full screen the short caption gets a pool of shade sized to itself
  rather than relying on a text shadow over a bright picture.
- The side menu fades out along its right edge — blur included — instead of
  ending on a line, and its row separators fade with it.
- Lobby covers shift about a third as far under the pointer. The light is
  unchanged.
- The About hero pans by background-position, so the pointer reaches the
  picture's own corners and never an edge beyond them.
- Fixed: the navigation buttons stayed faintly visible in full screen when
  the pointer was outside the window.
- The menu's hover highlight fades out to the right instead of ending on a
  rectangle edge.

- A picture whose shape leaves a bar above and below it now sits below the
  navigation buttons instead of centred behind them.
- Fixed: entering a room by clicking the button left the keyboard shortcuts
  dead, because focus stayed on the button after its subtree was hidden.

- The About room now has a hero image, set as the collection's `cover`. It
  fronts the panel in the lobby and fills the room behind the text. Because
  there is one picture and nothing to sell, the room has no paging, no
  thumbnails and no full screen — the only way out is out.

- Navigation now always sits at the top left: **Pictures** moved under
  **← Lobby** rather than sitting opposite it.
- `Return` enters the room you are looking at from the lobby, and takes a
  picture in and out of full screen from within a room.
- `Space` is limited to full screen, where there is no full label for the
  short one to collide with.

- The gallery itself, replacing the placeholder page: a lobby of rooms and
  rooms of full-screen pictures, with drag, wheel and keyboard navigation.
- Content is read from `assets/<room>/index.json` at boot — title, date,
  artist, medium, dimensions, description, price and sale status per picture.
  A sold picture keeps its place and shows no price.
- An About room with no pictures, for the artist's own text.
- Single-picture purchase pages at `/buy/<room>/<slug>`.
- Deep links: `#room` and `#room/picture`.
- `/health` now reports how many rooms and works were loaded, and the deploy
  checks those counts rather than only a 200.
