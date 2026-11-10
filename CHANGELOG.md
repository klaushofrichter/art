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

     Last released: v2026.11.10.1 (its notes cleared here). -->
## [Unreleased]

- **Readable over every picture on the live site.** The first live check
  measured the room label and the full-screen title against the real
  pictures, and over eleven of the 25 the label's Medium/Size lines or the
  full-screen title were still short of 4.5:1. Measured again over every
  picture: on a phone the label is one tall column, so its title and byline
  reach over the foot of the picture itself (down to 1:1 on an iPhone-sized
  screen). Now the shade at the foot of a room is darker where the
  Medium/Size lines sit and, on a phone, reaches up behind the whole label;
  the pool of shade behind the full-screen title is a little darker and wider.
