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

     Currently empty. Last released: v2026.09.06.1. -->
## [Unreleased]

- **A work can have more than one photograph.** A flat scan cannot show how
  big a painting is or what the paint does, so `views` in `index.json` adds
  further shots of the same work — framed on a wall, or a close-up of the
  brushwork. In a room they sit on the horizontal axis: left and right, a
  swipe sideways, or two arrows at the edges of the picture, with a caption
  saying which of them you are looking at. Up and down still move between
  works, and a work with no extra photographs shows no arrows at all. On the
  purchase page they are simply laid out under the picture.
- **The price now says what you are buying.** `$380 · Original · one of one`
  on one line, from a new optional `edition` field, instead of a price with
  the terms stacked somewhere above it. The enquiry button says what it does
  rather than how it does it.
- **Fixed: the purchase and legal pages could not be scrolled.** `height:100%`
  pinned the body to one viewport and the `overflow` it declared was
  propagated to the viewport rather than applied to the body, so anything
  past the fold was unreachable. It had gone unnoticed because every one of
  those pages happened to fit.

