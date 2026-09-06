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

- **A per-visitor rate limit: 300 requests per five minutes.** A cold browse of
  the whole gallery is around 30 requests, and it is counted per
  address rather than globally — a hundred people browsing at once never touch
  each other's budget. `/health` is exempt, because a 429 on the readiness
  probe would have Knative restart the pod.
- **`trust proxy` is set, which is what makes the above safe.** Nothing reaches
  the app directly, so `req.ip` had been Knative's queue-proxy — one in-cluster
  address shared by every visitor. Keying a limit on that would have been a
  single global bucket that only misbehaves under load. The setting takes a
  CIDR list rather than a hop count, and the limiter skips any request that
  still resolves to an in-cluster address rather than counting it.
