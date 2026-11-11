#!/usr/bin/env bash
# One-command runner for the backend-dependent benchmarks (issuance/revocation latency and
# application-level security tests), on YOUR MAC, local services only.
#
#   cd "/Users/dhanushgowda/Desktop/kredent 2"
#   mkdir -p benchmarks/results/logs-stage2
#   bash benchmarks/scripts/run-stage2-mac.sh 2>&1 | tee benchmarks/results/logs-stage2/run-stage2-mac.log
#
# It starts: local PostgreSQL (127.0.0.1:54329), a fresh LOCAL Hardhat node (127.0.0.1:8545),
# the local contract, mock storage (127.0.0.1:54321) and the UNCHANGED backend (127.0.0.1:8081)
# via benchmarks/scripts/start-backend-local.sh (which clears every Supabase/Amoy/secret variable).
# Then it runs issuance/run.mjs and security/run.mjs, rebuilds the report, and stops what it started.
#
# Safety: aborts if any of those ports is already in use (so it can never kill or reuse a process
# you did not start through this script). Nothing is sent to Polygon Amoy or Supabase. No project
# file other than git-ignored generated state (benchmarks/.local-chain.json, backed up first) is changed.
# Bash 3.2 compatible (macOS default).
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
LOGS="$ROOT/benchmarks/results/logs-stage2"
mkdir -p "$LOGS"
PORTS="54329 8545 54321 8081"
N="${N:-35}"

for p in $PORTS; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ABORT: port $p is already in use. Stop whatever is using it (for example services left over from the stage-1 run), then re-run."
    lsof -nP -iTCP:"$p" -sTCP:LISTEN | head -3
    exit 2
  fi
done

STARTED=""
cleanup() {
  echo "[stage2] stopping local services I started..."
  for p in $PORTS; do
    pids="$(lsof -nP -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    [ -n "$pids" ] && kill $pids 2>/dev/null
  done
  sleep 3
  for p in $PORTS; do
    pids="$(lsof -nP -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  done
  echo "[stage2] stopped."
}
trap cleanup EXIT

wait_port() { # port name timeoutSeconds
  local i=0
  while ! nc -z 127.0.0.1 "$1" >/dev/null 2>&1; do
    i=$((i+1)); [ "$i" -gt "$3" ] && { echo "TIMEOUT waiting for $2 on port $1 - see $LOGS"; return 1; }
    sleep 1
  done
  echo "[stage2] $2 is up on :$1"
}

[ -f benchmarks/.local-chain.json ] && cp -n benchmarks/.local-chain.json benchmarks/.local-chain.stage1-backup.json

echo "[stage2] 1/6 local PostgreSQL"
( mvn -q -f benchmarks/local-db/pom.xml compile exec:java > "$LOGS/s2-local-db.log" 2>&1 & )
wait_port 54329 "PostgreSQL" 180 || exit 3

echo "[stage2] 2/6 local Hardhat node"
( cd blockchain && npx hardhat node --hostname 127.0.0.1 --port 8545 > "$LOGS/s2-hardhat-node.log" 2>&1 & )
wait_port 8545 "Hardhat node" 60 || exit 3

echo "[stage2] 3/6 deploy local contract"
( cd blockchain && npx hardhat run scripts/bench/deploy-local.js --network localhost ) > "$LOGS/s2-deploy-local.log" 2>&1 || { cat "$LOGS/s2-deploy-local.log"; exit 3; }

echo "[stage2] 4/6 mock storage"
( node benchmarks/mock-storage/server.mjs > "$LOGS/s2-mock-storage.log" 2>&1 & )
wait_port 54321 "mock storage" 30 || exit 3

echo "[stage2] 5/6 backend (unchanged code, local config)"
( bash benchmarks/scripts/start-backend-local.sh > "$LOGS/s2-backend.log" 2>&1 & )
wait_port 8081 "backend" 240 || exit 3
sleep 5

echo "[stage2] 6/6 benchmarks"
cd "$ROOT/benchmarks"
[ -d node_modules ] || npm install --no-audit --no-fund
node issuance/run.mjs --n="$N" --warmup=3 --label=stage2-issuance 2>&1 | tee "$LOGS/s2-issuance.log"
node security/run.mjs --label=stage2-security 2>&1 | tee "$LOGS/s2-security.log"
node report/build-report.mjs 2>&1 | tee "$LOGS/s2-report.log"
echo "[stage2] finished. Report: benchmarks/results/FINAL-REPORT/Kredent_Performance_Report.md"
