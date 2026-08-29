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
