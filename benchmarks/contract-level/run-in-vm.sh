#!/usr/bin/env bash
# Starts a throw-away LOCAL Hardhat node (scratch copy of hardhat 2.29.0, 127.0.0.1:8545 only),
# runs contract-bench.mjs against it, then stops the node. Usage: run-in-vm.sh <hardhat-dir> <bench args...>
set -u
HH_DIR="$1"; shift
cd "$HH_DIR" && npx hardhat node --hostname 127.0.0.1 --port 8545 > "$HH_DIR/node.log" 2>&1 &
NODE_PID=$!
for i in $(seq 1 30); do curl -s -m 1 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:8545 >/dev/null 2>&1 && break; sleep 1; done
cd "$(dirname "$0")/.." && node contract-level/contract-bench.mjs "$@"
RC=$?
kill $NODE_PID 2>/dev/null; wait $NODE_PID 2>/dev/null
exit $RC
