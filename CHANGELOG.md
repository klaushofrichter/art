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
