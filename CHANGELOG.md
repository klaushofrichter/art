# Changelog

Versions are **generated at deploy time**, not carried in the sources: a merge
into `production` is tagged `vYYYY.MM.DD.N`, where `N` counts that day's
releases. Nothing needs bumping and nothing can be forgotten.

Each release's notes are assembled from the commits since the previous one,
preceded by anything curated under Unreleased below. The full history lives on
the [releases page](https://github.com/klaushofrichter/art/releases); this file
is where notes are written *before* a release, not an archive of them.

<!-- Anything written under Unreleased is prepended to the next release's
     notes. Keep prose out of it unless you mean it to be published.

     The release clears it: after each release, deploy-production.yml takes
     the lines it published out of this section on main, in a commit "Clear
     the changelog after vX [skip ci]" (scripts/clear-unreleased.sh). If that
     push ever fails the deploy warns, and the next promotion's
     scripts/check-changelog.sh names the leftovers; then clear them by hand.
     Before this was automatic, notes were published twice or blocked a
     release PR five times.

     Leave the section genuinely empty when there is nothing to say. Do not
     write a placeholder under the heading: the awk prints every non-blank
     line it finds there, so "nothing yet" would be published as the notes.

     -->
## [Unreleased]

- Privacy: the downloadable originals no longer carry the camera's GPS position.
  `scripts/sync-assets.sh` removes it before every upload (losslessly: same pixels,
  colour profile and other camera data), and the content check refuses a picture
  that still has one. The originals already online are cleaned the same way.

