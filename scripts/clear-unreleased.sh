#!/usr/bin/env bash
# Take the notes a release just published out of CHANGELOG.md's [Unreleased].
#
#     scripts/clear-unreleased.sh CHANGELOG.md PUBLISHED_NOTES
#
# PUBLISHED_NOTES is what scripts/unreleased-notes.sh printed for the release,
# i.e. exactly the curated lines that went into its notes. deploy-production.yml
# runs this on main after the release is created, then commits the result.
#
# Only lines that were published are removed. A note merged into main after
# the promotion (so not in this release) stays where it is and goes out with
# the next one; emptying the whole section, as steps-service does, would have
# lost it. Everything outside the section, the comment above the heading
# included, is left byte for byte. The section that remains is the heading,
# one blank line, and whatever was kept. Rewrites the file in place; leaves it
# untouched when there is nothing to take out.
set -euo pipefail

FILE="${1:?usage: clear-unreleased.sh CHANGELOG.md PUBLISHED_NOTES}"
NOTES="${2:?usage: clear-unreleased.sh CHANGELOG.md PUBLISHED_NOTES}"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

awk '
  # The published lines, blank ones aside. By file name, not the usual
  # FNR == NR: with an EMPTY notes file that test stays true for CHANGELOG.md
  # too, every line counted as published, and the whole file was emptied.
  FILENAME == ARGV[1] { if ($0 !~ /^[[:space:]]*$/) published[$0] = 1; next }

  # Up to the heading: as it is.
  !seen && /^## \[Unreleased\]/ { print; seen = 1; inside = 1; next }
  !inside { print; next }

  # The section ends at the next heading of the same level or higher, which
  # is where scripts/unreleased-notes.sh stops reading too.
  /^## / { flush(0); inside = 0; print; next }

  {
    if ($0 ~ /^[[:space:]]*$/) { kept[++n] = ""; next }
    if ($0 in published) next
    kept[++n] = $0
  }

  # The kept lines, without blank lines at either end or two in a row, set
  # off from the heading by one blank line and from a following heading by
  # another. At the end of the file nothing follows them.
  function flush(atEnd,   i, out, last, any) {
    out = ""; last = "blank"; any = 0
    for (i = 1; i <= n; i++) {
      if (kept[i] == "") { if (last != "blank") { out = out "\n"; last = "blank" } continue }
      out = out kept[i] "\n"; last = "text"; any = 1
    }
    sub(/\n+$/, "\n", out)
    printf "\n"
    if (any) printf "%s%s", out, (atEnd ? "" : "\n")
    n = 0
  }
  END { if (inside) flush(1) }
' "$NOTES" "$FILE" > "$tmp"

# A file whose section held only blank lines comes out the same; so does one
# whose notes were already taken out. Then there is nothing to write.
if cmp -s "$tmp" "$FILE"; then
  echo "clear-unreleased: nothing to take out of [Unreleased]."
  exit 0
fi
cat "$tmp" > "$FILE"
echo "clear-unreleased: took the published notes out of [Unreleased]."
