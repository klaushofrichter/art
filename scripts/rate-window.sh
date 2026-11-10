#!/usr/bin/env bash
# Report how much of this address's rate-limit budget the live site has left,
# and wait for a fresh window when less than MIN is left.
#
#   scripts/rate-window.sh https://art.klaushofrichter.net 250
#
# The site allows 300 page requests per five minutes per address
# (src/ratelimit.ts), in a fixed window, and a GitHub runner is one address.
# live-check.yml calls this between its two halves, so that each starts with
# most of a window and neither comes near the limit, and once at the end to
# log what the run spent. It costs one request (a HEAD of /terms, a page).
set -euo pipefail

BASE="${1:?usage: rate-window.sh BASE_URL [MIN]}"
MIN="${2:-250}"

headers=$(curl -sSI "$BASE/terms")
remaining=$(printf '%s' "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="ratelimit-remaining"{print $2}')
limit=$(printf '%s' "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="ratelimit-limit"{print $2}')
reset=$(printf '%s' "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="ratelimit-reset"{print $2}')
[ -n "$remaining" ] || { echo "::warning::no rate-limit headers from $BASE/terms"; exit 0; }
echo "rate limit: ${remaining} of ${limit} left in this window, which resets in ${reset}s"
if [ "$remaining" -lt "$MIN" ]; then
  echo "waiting ${reset}s for a fresh window"
  sleep $((reset + 2))
fi
