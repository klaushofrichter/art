#!/usr/bin/env bash
# Make smaller copies of every picture, so a phone is not sent a 3000px
# original to display in a 400px frame.
#
# Each width lands in its own directory beside the original, keeping the
# filename: assets/colors/w1024/IMG_7281.jpg. The original is never touched
# and never replaced — it is what the download link serves, and what the
# server falls back to when no derivative fits.
#
# Run by sync-assets.sh before it uploads, so what reaches the volume has
# already been made and checked. Content is not part of a deploy any more, so
# this is the equivalent moment.
#
#     scripts/make-derivatives.sh [dir]        # default: assets
#     FORCE=1 scripts/make-derivatives.sh      # rebuild even if up to date
set -euo pipefail

SRC="${1:-assets}"
# A ladder wide enough for a phone at 3x through to a 2560 display. Anything
# at or above a picture's own width is skipped rather than upscaled.
WIDTHS=(640 1024 1536 2048 2560)
QUALITY=3          # ffmpeg mjpeg scale, 2 is best; 3 keeps brushwork and grain
# WebP sits beside each resized JPEG for browsers that ask for it. 85 was
# chosen by measurement, not habit: across the collection it is 9-24% smaller
# than the JPEG *and* scores higher SSIM against a lossless reference, so it
# is strictly better rather than a size-for-quality trade. Above 90 WebP gets
# larger than the JPEG; below 82 it drops under it on quality.
WEBP_QUALITY=85

cd "$(dirname "$0")/.."

if [ ! -d "$SRC" ]; then
  echo "make-derivatives: no such directory: $SRC" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "make-derivatives: ffmpeg not found — skipping." >&2
  echo "  The site still works: it serves the originals where no smaller copy exists." >&2
  exit 0
fi

made=0 skipped=0 kept=0

# Room directories only, and never a width directory we made ourselves.
for room in "$SRC"/*/; do
  [ -d "$room" ] || continue
  for file in "$room"*; do
    [ -f "$file" ] || continue
    case "${file##*.}" in
      jpg|jpeg|JPG|JPEG|png|PNG) ;;
      *) continue ;;
    esac
    name=$(basename "$file")
    width=$(ffprobe -v error -select_streams v:0 -show_entries stream=width \
              -of csv=p=0 "$file" 2>/dev/null || echo 0)
    [ "${width:-0}" -gt 0 ] || { echo "  ? $name — cannot read size, left alone"; continue; }

    for w in "${WIDTHS[@]}"; do
      # No upscaling, and no copy that is barely smaller than the original.
      if [ "$w" -ge "$width" ]; then skipped=$((skipped + 1)); continue; fi
      out="${room}w${w}/${name}"
      if [ -z "${FORCE:-}" ] && [ -f "$out" ] && [ "$out" -nt "$file" ]; then
        kept=$((kept + 1)); continue
      fi
      mkdir -p "${room}w${w}"
      ffmpeg -y -loglevel error -i "$file" \
        -vf "scale=${w}:-2:flags=lanczos" -q:v "$QUALITY" "$out"
      made=$((made + 1))
    done

    # And the WebP of each, same widths, same rule about not upscaling. The
    # original is never converted: it stays exactly the file that was shot,
    # and it is what the download link serves.
    for w in "${WIDTHS[@]}"; do
      if [ "$w" -ge "$width" ]; then continue; fi
      outw="${room}w${w}/${name%.*}.webp"
      if [ -z "${FORCE:-}" ] && [ -f "$outw" ] && [ "$outw" -nt "$file" ]; then
        kept=$((kept + 1)); continue
      fi
      mkdir -p "${room}w${w}"
      ffmpeg -y -loglevel error -i "$file" \
        -vf "scale=${w}:-2:flags=lanczos" \
        -c:v libwebp -quality "$WEBP_QUALITY" -compression_level 6 "$outw"
      made=$((made + 1))
    done
  done
done

echo "make-derivatives: ${made} made, ${kept} already current, ${skipped} skipped as too large"

# What it bought, in the terms that matter: what a phone downloads instead.
if command -v du >/dev/null 2>&1; then
  orig=$(find "$SRC" -type f \( -iname '*.jpg' -o -iname '*.png' \) -not -path '*/w[0-9]*/*' -exec du -k {} + 2>/dev/null | awk '{s+=$1} END {print s+0}')
  small=$(find "$SRC" -type d -name 'w1024' -exec find {} -type f \; 2>/dev/null | xargs du -k 2>/dev/null | awk '{s+=$1} END {print s+0}')
  if [ "${small:-0}" -gt 0 ]; then
    echo "  originals ${orig}KB; the same pictures at 1024px ${small}KB"
  fi
fi
