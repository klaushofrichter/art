# CLAUDE.md

Operational context for working in this repo.

## What this is

An art gallery site served at `art.klaushofrichter.net` — an
Express/TypeScript app deployed as a Knative Service on the
`kube-setup`-managed k3s cluster (see `../kube-setup/CLAUDE.md` for
cluster-wide context).

A **lobby** of room panels, and **rooms** of full-screen pictures. Design
direction and the reasoning behind it are in the mockups linked from the
project history; `README.md` documents the behaviour and the content schema.

## Motion: springs, not transitions

Everything the pointer or a drag moves — the lobby light, the cover drift,
the rail that carries panels and pictures — is a spring stepped once per
`requestAnimationFrame` in `public/app.js`. **Do not put a CSS `transition`
on any of those properties.** An earlier version did, and a transition
smoothing a value that pointer events already rewrite every frame is exactly
what made it feel choppy; the two fight each other.

The tuning constants sit together at the top of `public/app.js`
(`RAIL_K`/`RAIL_D`, `LIGHT_K`/`LIGHT_D`). For a spring stepped this way,
`omega = sqrt(K)` and the damping ratio is `(1 - D) / (2 * sqrt(K))`. Lower
`K` is slower; higher `D` is looser and overshoots more. The rail is tuned to
~0.3s to 90% with almost no overshoot (heavy, not bouncy); the light lags
about 0.2s and overshoots ~17%, which is the drift-on-after-you-stop effect.
Change them by reasoning about those two numbers, not by trial and error.

CSS transitions are still correct for discrete state changes — a drawer
sliding, a label fading, the picture growing when the text is cleared.

The site is **fully public** — deliberately no OAuth, no sessions, no
secrets. It needs no `.env`; the only configuration it reads is `PORT`.
Keep it that way unless there's a reason not to: the sibling
`../www-klaushofrichter` carries a Google OAuth login and is the repo to
copy from if authentication is ever wanted here.

## Content lives on a volume, not in code and not in git

This repo is public and the artwork is not in it. `assets/` is git-ignored and
the image does not carry it; `src/content.ts` reads whatever `ASSETS_DIR`
points at, which in production is a PVC mounted read-only at `/data/assets`.
`scripts/pull-assets.sh` and `scripts/sync-assets.sh` move content between the
volume and a working copy. **Never re-add `assets/` to git or to the
Dockerfile** — that is the whole point of the arrangement.

Because content is no longer part of a deploy, the server watches the
directory (`CONTENT_WATCH_MS`, default 10s) and re-renders in place. The
schema and the `status` rules are documented in `README.md`. Four things worth
keeping:

- A **sold** or **not-for-sale** picture's price is never serialised into the
  manifest at all (`src/views/gallery.ts`), rather than being sent and hidden
  by the client. There is a test for this.
- A malformed `index.json` **throws**, so the container fails its readiness
  probe instead of serving a partial gallery. A picture listed but missing on
  disk only warns and is skipped — a missing file shouldn't take the site down.
- That throw is caught on **reload**, where the rules invert: a bad edit on the
  volume must not take a healthy site down, so `reloadContent` keeps what it
  has and logs why. Same for content that vanishes. See `test/reload.test.ts`.
- The favicon is `public/palette.png`, not a file in the content directory — a
  content sync must not be able to take the site's own icon away.

## Pictures are sized for the screen, and the original is for download

`scripts/make-derivatives.sh` (run by `sync-assets.sh`) writes `w<width>/`
copies beside each picture. `Work.widths` says which exist; the manifest ships
those numbers and the browser builds the path, because **no URL from content
ever reaches a src**. Two rules: the largest copy is the ceiling for anything
displayed — never the original, however large the screen — and the download
link always serves the original at full resolution. Both are tested.

## The About room is deliberately not a picture room

It holds one hero (the collection's `cover`, not a work) and its text, so
`enterRoom` hands it to `enterAbout` before any of the rail, label, menu or
full-screen machinery is built. Don't be tempted to unify them: the whole
point is that there is nothing to page through, so there is no rail, no
counter, no dots, no Pictures menu and no `bare` state. Escape and Return
both just leave.

## Client assets are fingerprinted for a reason

`public/app.css` and `public/app.js` are served `immutable` for a year in
production, so their URLs carry a content hash (`src/fingerprint.ts`).
Without it a deploy would never reach anyone who had visited before. The
hard caching is disabled outside production, or local edits would be
invisible behind the same cache.

## Branches

- `main` — normal development, unprotected. Push here builds and pushes
  `ghcr.io/klaushofrichter/art:latest` + `:<sha>` via
  `.github/workflows/build-push.yml`, but does **not** deploy.
- `production` — protected, PR-only from `main`. Merging here triggers
  `.github/workflows/deploy-production.yml` on the in-cluster self-hosted
  runner, which builds/pushes the image, updates
  `kube-setup/manifests/art/art-ksvc.yaml`'s image tag, and applies it.

Required checks on `production` are `test` and `codeql`. The `e2e` job runs
on PRs too but is deliberately not required, matching
`../www-klaushofrichter`.

## Versioning and releases

A merge into `production` cuts a release. The version is generated in
`deploy-production.yml` as `vYYYY.MM.DD.N` — the date in Central time plus a
counter over the releases that already exist for that day. The tags are the
only state, so nothing is stored and nothing needs bumping; `package.json`
deliberately carries no `version` field.

The version is passed to the image build as `ARG APP_VERSION` and read back
by `src/version.ts`, which feeds `GET /health`. Local builds and tests see `dev`.

`/health` also reports the number of rooms and works it loaded, which is what
the deploy's smoke test checks — a deploy that shipped a broken `index.json`
would show the wrong counts rather than passing quietly.

Release notes come from the commits since the previous release, preceded by
anything under `## [Unreleased]` in `CHANGELOG.md`. The release step runs last
(after the rollout check and the curl smoke test), so a failed deploy produces
no release, and the checkout uses `fetch-depth: 0` because the notes are
computed from history and tags.

## Don't run Playwright on the self-hosted runner

The runner container is capped at 512Mi
(`kube-setup/manifests/art-runner/runner-deployment.yaml`), and installing a
browser there OOM-kills it; GitHub surfaces that as "The self-hosted runner
lost communication with the server", which reads like a network fault and is
not one. The Playwright suite runs in `production-checks.yml` on GitHub's
runners against a locally started server, and the deploy smoke-tests with
`curl`. Keep heavyweight installs off that runner.

## Cluster-side manifests

Live in `klaushofrichter/kube-setup`: `manifests/art/` (the Knative Service +
DomainMapping, `art` namespace) and `manifests/art-runner/` (this repo's
dedicated self-hosted runner — its own namespace/ServiceAccount/RBAC,
isolated from the other repos' runners per that repo's
`docs/self-hosted-runner-cicd-pattern.md`).
