# CLAUDE.md

Operational context for working in this repo.

## What this is

An art gallery site served at `art.klaushofrichter.net` — an
Express/TypeScript app that server-renders the page, deployed as a Knative
Service on the `kube-setup`-managed k3s cluster (see
`../kube-setup/CLAUDE.md` for cluster-wide context).

**The page is a placeholder.** The gallery's real content and design are
still to be specified; what exists is the infrastructure around it. Don't
treat the current `src/views/` markup as a design to preserve.

The site is **fully public** — deliberately no OAuth, no sessions, no
secrets. It needs no `.env`; the only configuration it reads is `PORT`.
Keep it that way unless there's a reason not to: the sibling
`../www-klaushofrichter` carries a Google OAuth login and is the repo to
copy from if authentication is ever wanted here.

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
by `src/version.ts`, which feeds `GET /health` and the `#app-version` label
in the page footer. The deploy's curl smoke test greps for that exact id, so
don't drop it from the markup without updating the workflow. Local builds and
tests see `dev`.

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
