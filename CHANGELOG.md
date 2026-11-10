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

     Currently empty. Last released: v2026.09.09.1. -->
## [Unreleased]


**Public-pages baseline** (kube-setup's "public web pages" requirement): the
`e2e` check now tests the Docker image in four browsers (desktop Chrome, an
Android phone, an iPhone/WebKit, desktop Firefox) with `failOnFlakyTests`,
walks every room, picture and link, runs axe (WCAG 2.2 AA) in every state and
menu with the contrast over pictures measured on screen, and gates Lighthouse
on a phone (lobby and a room). A new `live-check.yml` runs the read-only part
against the live site after each deploy and daily.

- **The rate limit now counts pages only.** Pictures, the stylesheet, the
  script, the fonts and the favicon no longer spend the 300 per five minutes;
  a visit to the lobby used to cost about 28 of them. Pages, purchase pages
  and the 404 page (which a missing file falls through to) still count. The
  live check only fits its budget once this is released.
- **A proper 404 page** in the site's style, with a way back to the gallery,
  instead of Express's bare "Cannot GET". An unknown purchase page uses it too.
- **Readable over any picture:** the Lobby/Content/full-screen buttons, the
  arrows, the view caption and the full-screen hint have darker backings; the
  picture counter, the hint and the caption text are brighter; the Medium/Size
  labels are a lighter grey; the label's shade at the foot of a room reaches a
  little higher; on a phone the lobby's shade reaches across the caption; and
  the side menu's dark backing reaches further right before it fades.
- **Small labels are 12px** and no longer shrink to 9px on a phone (Lighthouse
  "legible font sizes"; best practices was 96).
- **No jump on purchase pages:** the main picture, and the thumbnails of the
  no-JavaScript index, now hold their place before they load.
- A room opened from a shared link no longer downloads the lobby covers while
  its own picture is loading.
