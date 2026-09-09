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

     CLEAR THIS AFTER A RELEASE. Nothing does it automatically: the release
     step reads this file and does not write to it, so entries left here go
     out again with the following release. That has happened three times —
     the WebP notes shipped twice, and the spotlight and rate-limit notes
     were each caught on their way to a second appearance. Emptying it is
     part of promoting to production, not an afterthought.

     Leave the section genuinely empty when there is nothing to say. Do not
     write a placeholder under the heading: the awk prints every non-blank
     line it finds there, so "nothing yet" would be published as the notes.

     Currently holds the review fixes. Last released: v2026.09.07.1. -->
## [Unreleased]

- **Fixed: `/assets/<room>/index.json` was public.** The pictures are served
  out of the same directory the manifest sits in, so the whole of it was
  fetchable — every uid and `purchase_url`, the contact address, and the
  prices of sold work the page deliberately never sends. `/assets` now serves
  picture files only.
- **Fixed: the content watcher could take the site down.** A dangling symlink,
  or a file disappearing while a content sync swapped the tree, threw out of
  the timer and ended the process. It also read the directory a second time
  after a reload had already succeeded, outside the guard that exists to
  survive a bad edit.
- **Fixed: a replaced picture never reached anyone who had seen the old one.**
  Pictures are cached for a year, but they are replaced by a content sync
  under the same filename, so the URL never changed and the old copy stayed
  pinned. Every picture URL now carries a version built from the file and its
  smaller copies, the way the stylesheet and the script already did.
- **Fixed: a room id from content could break out of an HTML attribute.**
  `collection.id` is arbitrary text — it is not required to match the folder
  it was read from — and it reached the purchase page's crumb link unescaped.
- **An About block that is not quite the right shape no longer throws.** A
  `body` written as one string rather than a list used to fail in the middle
  of rendering the page.
- **Fixed: a deploy could fail on a healthy release.** The smoke test compared
  the served version exactly once, immediately after `kubectl wait` returned —
  which it can do while the previous revision is still answering. It now waits
  for the new version rather than for the first 200.

