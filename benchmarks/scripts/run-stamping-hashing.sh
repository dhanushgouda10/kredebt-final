#!/usr/bin/env bash
# Runs the stamping + hashing micro-benchmark in N separate JVM launches (default 3) under one
# run id, then writes a pooled summary. Needs no database, storage, network or blockchain.
#
# Run from the repository root:  bash benchmarks/scripts/run-stamping-hashing.sh [launches] [label]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAUNCHES="${1:-3}"
RUN_ID="$(date -u +%Y%m%d-%H%M%S)-${2:-stamping-hashing}"

if [ -x /usr/libexec/java_home ] && /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
fi
echo "[bench] JDK: $("${JAVA_HOME:+$JAVA_HOME/bin/}java" -version 2>&1 | head -1)"

cd "$ROOT/backend"
for i in $(seq 1 "$LAUNCHES"); do
  echo "[bench] launch $i/$LAUNCHES (run $RUN_ID)"
  mvn -q -Dkredent.bench=true -Dkredent.bench.runId="$RUN_ID" -Dkredent.bench.launch="$i" \
      -Dtest=StampingHashingBenchmarkTest -Dsurefire.failIfNoSpecifiedTests=false test
done

cd "$ROOT/benchmarks"
node stamping-hashing/summarize.mjs --run="$RUN_ID"
echo "[bench] done: benchmarks/results/$RUN_ID/stamping-hashing/"
