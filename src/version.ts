// Baked in by the Docker build (ARG APP_VERSION); "dev" when running locally.
// Read per call rather than at module load, so the value is observable
// rather than frozen at import time.
export function appVersion(): string {
  return process.env.APP_VERSION || 'dev';
}
