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

     Currently holds the arrows note. Last released: v2026.09.06.3. -->
## [Unreleased]

- **The view arrows announce themselves as they arrive.** Two small arrows at
  the edges of a picture were easy to miss, and a work having more than one
  photograph is the exception rather than the rule, so nobody was going to
  find the axis by accident. They now carry a second of warm amber as they
  appear — and only then: paging between two works that both have views never
  takes them away, and re-lighting them at every step would nag rather than
  hint.

