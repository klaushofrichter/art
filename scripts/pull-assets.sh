#!/usr/bin/env bash
# Copy the gallery's content down from the cluster volume into ./assets.
#
# The pictures are not in git, so the volume is the source of truth and this
# is how you get a working copy: on a fresh clone, on a second machine, or to
# see what is actually live before editing it.
#
# It refuses to overwrite an existing directory. Pass a destination if you
# want a copy beside the one you have:
#     scripts/pull-assets.sh assets.live
set -euo pipefail

DEST="${1:-assets}"

cd "$(dirname "$0")/.."
. scripts/content-pod.sh

if [ -e "$DEST" ]; then
  echo "pull-assets: $DEST already exists — move it aside, or name another destination" >&2
  exit 1
fi

wake_content_pod

# Stream into a temporary directory and move it into place, so an interrupted
# pull leaves nothing behind that looks like content.
TMP=$(mktemp -d "./.pull-assets.XXXXXX")
on_exit 'rm -rf "$TMP"'
echo "==> copying from $POD"
# Land the archive as a file before unpacking rather than piping straight into
# tar: a pipe hides a short read, so a truncated stream looks like a corrupt
# archive at the far end instead of a failed transfer. -i keeps kubectl from
# closing the stream early.
$KUBECTL exec -i -n $NS "$POD" -- \
  tar -C /data/assets --exclude='._*' --exclude='.DS_Store' -czf - . > "$TMP/assets.tgz"
tar -C "$TMP" -xzf "$TMP/assets.tgz"
rm -f "$TMP/assets.tgz"
mv "$TMP" "$DEST"
chmod 755 "$DEST"

echo "==> checking what came down"
npx tsx scripts/check-assets.ts "$DEST"
echo "==> done. $DEST is a working copy; scripts/sync-assets.sh pushes it back."
