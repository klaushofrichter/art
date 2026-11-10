#!/usr/bin/env bash
# Run Lighthouse (the engine behind Google's PageSpeed Insights) against one
# or more URLs, in its default mobile mode, and fail if any category drops
# below its floor.
#
#   scripts/lighthouse-gate.sh http://localhost:8080/ 'http://localhost:8080/?id=fixwide1'
#   scripts/lighthouse-gate.sh https://art.klaushofrichter.net/
#
# Needs a Chrome: CHROME_PATH, or google-chrome on PATH (GitHub's runners have
# one). Writes each URL's median report to lighthouse-report[-N].report.html.
#
# Copied from klaushofrichter/www-skylar-technology, which took it from
# klaushofrichter/christina.art, the reference for kube-setup's "public web
# pages" baseline (docs/cluster-deployment-requirements.md, §4). This copy
# takes several URLs, because the gallery has two kinds of first screen: the
# lobby, and a room opened from a shared link.
#
# Floors: performance >= 90, everything else 100, because a drop there is
# always a real defect (a contrast slip, text too small to read, a console
# error), never noise. Measured 2026-11-09 on https://art.klaushofrichter.net
# before this gate existed (three runs each): the lobby 100/100/96/100 and a
# fifteen-picture room 90-92/100/96/100. Best practices lost its points to
# "legible font sizes" (labels down to 9px on a phone), fixed with the gate.
#
# Lighthouse runs LH_RUNS times per URL (default 3). Performance is judged on
# the MEDIAN run, as Lighthouse's own docs advise for its run-to-run variance
# (in christina.art one run on a busy GitHub runner scored 81 where three
# runs from elsewhere scored 100). Every other category must hold in EVERY
# run.
#
# Against the live site every run is about a dozen requests for the lobby and
# about forty for a room (it fetches all of its pictures), all counted by the
# site's rate limit (300 per five minutes per address). live-check.yml
# therefore gates the lobby only; the room is gated in CI, where the server
# limits nothing.
set -euo pipefail

[ $# -gt 0 ] || { echo "usage: lighthouse-gate.sh URL [URL...]"; exit 2; }
declare -A FLOOR=([performance]=90 [accessibility]=100 [best-practices]=100 [seo]=100)

CHROME_PATH="${CHROME_PATH:-$(command -v google-chrome || command -v chromium || true)}"
[ -n "$CHROME_PATH" ] || { echo "::error::no Chrome found for Lighthouse"; exit 1; }
export CHROME_PATH

RUNS="${LH_RUNS:-3}"
failed=0
k=0
for URL in "$@"; do
  OUT="lighthouse-report$([ $k -gt 0 ] && echo "-$k" || true)"
  k=$((k + 1))
  echo "== $URL"
  for n in $(seq 1 "$RUNS"); do
    npx --yes lighthouse@12 "$URL" \
      --quiet \
      --chrome-flags="--headless=new --no-sandbox" \
      --only-categories=performance,accessibility,best-practices,seo \
      --output=json --output=html --output-path="./$OUT-run$n"
  done

  # The median run by performance becomes the report; the rest are dropped.
  median=$(node -e "
const runs=[];for(let n=1;n<=$RUNS;n++)runs.push({n,p:require('./$OUT-run'+n+'.report.json').categories.performance.score});
runs.sort((a,b)=>a.p-b.p);console.log(runs[Math.floor(runs.length/2)].n)")
  echo "Lighthouse performance per run: $(for n in $(seq 1 "$RUNS"); do node -e "process.stdout.write(Math.round(require('./$OUT-run$n.report.json').categories.performance.score*100)+' ')"; done)(median: run $median)"

  for cat in performance accessibility best-practices seo; do
    if [ "$cat" = performance ]; then
      score=$(node -e "console.log(Math.round(require('./$OUT-run$median.report.json').categories.performance.score*100))")
    else
      # The lowest of all runs: these never vary on a sound page.
      score=$(node -e "let m=100;for(let n=1;n<=$RUNS;n++)m=Math.min(m,Math.round(require('./$OUT-run'+n+'.report.json').categories['$cat'].score*100));console.log(m)")
    fi
    floor=${FLOOR[$cat]}
    if [ "$score" -lt "$floor" ]; then
      echo "::error::Lighthouse $cat is $score on $URL, below $floor"
      failed=1
    else
      echo "Lighthouse $cat: $score (floor $floor)"
    fi
  done

  cp "$OUT-run$median.report.json" "$OUT.report.json"
  cp "$OUT-run$median.report.html" "$OUT.report.html"
  for n in $(seq 1 "$RUNS"); do rm -f "$OUT-run$n.report.json" "$OUT-run$n.report.html"; done

  # Name what lost points (in the median run), so nobody has to open the
  # report to start fixing.
  node -e "
const a=require('./$OUT.report.json').audits;
for (const [id,x] of Object.entries(a))
  if (x.score!==null && x.score<0.9 && !['informative','notApplicable','manual'].includes(x.scoreDisplayMode))
    console.log('  below 90: '+id+' '+(x.displayValue||''));
for (const k of ['first-contentful-paint','largest-contentful-paint','cumulative-layout-shift','total-blocking-time','total-byte-weight'])
  console.log('  '+k+': '+a[k].displayValue);
"
done
exit $failed
