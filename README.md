# art.klaushofrichter.net

An art gallery, served at [art.klaushofrichter.net](https://art.klaushofrichter.net).

The site is public — no login, no accounts, nothing to sign into. It is an
Express/TypeScript app that server-renders the gallery page and runs as a
[Knative](https://knative.dev/) Service on a self-hosted single-node k3s
cluster (see [`klaushofrichter/kube-setup`](https://github.com/klaushofrichter/kube-setup)).

**Status:** infrastructure is complete and live; the page itself is a
placeholder. The gallery's actual content and design are still to come.

## Running it locally

```bash
npm ci
npm run dev          # http://localhost:8080
```

Other scripts:

| Command            | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `npm run build`    | Compile TypeScript into `dist/`                      |
| `npm start`        | Run the compiled server                              |
| `npm test`         | Unit tests (vitest + supertest)                      |
| `npm run test:e2e` | Playwright smoke test against a running server       |

There is no `.env` to set up — the app takes no configuration beyond an
optional `PORT` (default `8080`).

## Endpoints

- `GET /` — the gallery page
- `GET /health` — `{"status":"ok","service":"art","version":"..."}`
- `GET /assets/*` — static files from `assets/`

## Branches and deployment

- **`main`** — normal development, unprotected. A push here builds and pushes
  `ghcr.io/klaushofrichter/art:latest` and `:<sha>`, but does **not** deploy.
- **`production`** — protected, PR-only from `main`, with `test` and `codeql`
  as required checks. Merging here runs the deploy on an in-cluster
  self-hosted runner: build the image, update the ksvc manifest in
  `kube-setup`, apply it, verify the rollout, smoke-test the live site, and
  cut a GitHub release.

To ship: open a PR from `main` to `production`, let the checks pass, merge.

## Versioning

Versions are generated at deploy time as `vYYYY.MM.DD.N` (Central time, `N`
counting that day's releases) and baked into the image as `APP_VERSION`. The
running container reports it on `/health` and in the page footer. `package.json`
deliberately carries no `version` field — the release tags are the only state.

## License

[MIT](LICENSE)
