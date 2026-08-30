#!/usr/bin/env bash
# Push the local ./assets to the gallery's volume in the cluster.
#
# The content does not live in git, so this is how it reaches production. It
# is deliberately not part of the CI deploy: code ships through PR and checks,
# content ships through here.
set -euo pipefail

NS=art
DEPLOY=art-content
SRC="${1:-assets}"
KUBECTL="${KUBECTL:-kubectl}"

cd "$(dirname "$0")/.."

if [ ! -d "$SRC" ]; then
  echo "sync-assets: no such directory: $SRC" >&2
  exit 1
fi

# 1. Make the smaller copies a phone should get instead of a 3000px original.
#    Content is not part of a deploy any more, so this is the moment for it.
#    Skipped harmlessly if ffmpeg is not installed.
if [ -z "${NO_DERIVATIVES:-}" ]; then
  echo "==> sizing pictures"
  scripts/make-derivatives.sh "$SRC"
fi

# 2. Refuse to push content the server could not serve. This is the only gate
#    content gets, so it runs before anything in the cluster is touched.
echo "==> checking $SRC"
npx tsx scripts/check-assets.ts "$SRC"

# 3. Wake the one pod allowed to write to the volume.
echo "==> waking $DEPLOY"
scaled_up=0
cleanup() {
  if [ "$scaled_up" = 1 ]; then
    echo "==> sending $DEPLOY back to sleep"
    $KUBECTL scale deploy/$DEPLOY -n $NS --replicas=0 >/dev/null
  fi
}
trap cleanup EXIT
$KUBECTL scale deploy/$DEPLOY -n $NS --replicas=1 >/dev/null
scaled_up=1
$KUBECTL rollout status deploy/$DEPLOY -n $NS --timeout=120s >/dev/null
POD=$($KUBECTL get pod -n $NS -l app=$DEPLOY -o jsonpath='{.items[0].metadata.name}')

# 4. Stream it in and swap it into place. Extracting beside the live directory
#    and moving means the gallery never reads a half-written tree, and the
#    previous content stays as .old for a one-command rollback.
# COPYFILE_DISABLE stops macOS tar writing an AppleDouble "._name" shadow
# beside every file; without it a sync doubles the file count on the volume
# with junk, and a later pull chokes trying to read it back.
echo "==> copying to $POD"
COPYFILE_DISABLE=1 tar -C "$SRC" \
  --exclude='._*' --exclude='.DS_Store' -czf - . \
  | $KUBECTL exec -i -n $NS "$POD" -- sh -c '
  set -e
  rm -rf /data/incoming
  mkdir -p /data/incoming
  tar -C /data/incoming -xzf -
  rm -rf /data/assets.old
  if [ -d /data/assets ]; then mv /data/assets /data/assets.old; fi
  mv /data/incoming /data/assets
'

# 5. Say what is actually on the volume now, rather than what we hoped.
echo "==> on the volume:"
$KUBECTL exec -n $NS "$POD" -- sh -c '
  cd /data/assets
  for d in */; do
    printf "    %-12s %s files\n" "${d%/}" "$(ls "$d" | wc -l | tr -d " ")"
  done
  printf "    %s total\n" "$(du -sh . | cut -f1)"
'
echo "==> done. The gallery reloads within ~10s; no restart needed."
