# Kredent benchmarks (stage 1)

Stage 1 covers **PDF stamping**, **SHA-256 hashing** and **public verification**. Issuance,
revocation and batch benchmarks come in a later stage.

Everything here is new and benchmark-only. No existing application code, `pom.xml`,
`application*.properties`, `.env` file or Hardhat configuration is changed. Nothing in this folder
talks to Polygon Amoy, the real Supabase database or the real Supabase Storage bucket. Every
Node script refuses to run unless the backend URL and RPC URL point at `localhost` / `127.0.0.1`
and the chain reports ID 31337 (local Hardhat).

## Contents

| Path | What it is |
|---|---|
| `backend/src/test/java/com/kredent/backend/benchmark/StampingHashingBenchmarkTest.java` | Stamping + hashing micro-benchmark on the real production methods (skipped unless `-Dkredent.bench=true`) |
| `backend/src/test/java/com/kredent/backend/benchmark/BenchPdfFixtures.java` | Generates the 0.1 / 1 / 5 MB test PDFs (deterministic, seeded) |
| `backend/src/test/java/com/kredent/backend/benchmark/BenchStats.java` | Median / p95 / p99 / mean / min / max / std dev |
| `blockchain/scripts/bench/deploy-local.js` | Deploys the contract to the **local** Hardhat node only |
| `benchmarks/local-db/` | Stand-alone helper that runs a real PostgreSQL 16 on `127.0.0.1:54329` (no Docker needed) |
| `benchmarks/mock-storage/server.mjs` | Local stand-in for the 3 Supabase Storage calls the backend makes |
| `benchmarks/scripts/start-backend-local.sh` | Starts the unchanged backend wired only to the local services |
| `benchmarks/scripts/run-stamping-hashing.sh` | Runs the stamping/hashing benchmark in 3 JVM launches + pooled summary |
| `benchmarks/verification/seed.mjs` | Creates local test data (not timed) |
| `benchmarks/verification/run.mjs` | Verification latency and concurrency benchmarks |
| `benchmarks/stamping-hashing/summarize.mjs` | Pools the per-launch stamping/hashing CSVs |
| `benchmarks/lib/` | Shared stats, safety guards, config, CSV/JSON output |
| `benchmarks/results/` | Raw CSV + JSON output (git-ignored) |
| `benchmarks/fixtures/` | Generated PDFs (git-ignored) |

## Why a separate local database

The verification endpoint reads certificates from PostgreSQL, so the benchmark needs certificates
that are really MINTED on a chain the backend can read. Creating them means writing about 100
students, 100 certificates, their audit-log rows and their PDFs. Doing that in your real Supabase
project would mix fake records into real data and point those records at a throwaway local
contract. So the verification benchmark uses an isolated PostgreSQL that `benchmarks/local-db`
starts from Maven-downloaded binaries. No Docker or Postgres.app is needed, and the backend
creates its schema itself (existing `ddl-auto=update`).

Trade-off to state in the report: a local database removes the network round trip to Supabase,
so DB time here is lower than in your deployed setup. If you later want Supabase-realistic numbers,
the clean option is a **separate, empty Supabase project** used only for benchmarking (you would
put its connection details into your own shell; this tooling never asks for them).

The stamping and hashing benchmark needs no database at all.

## Prerequisites (macOS)

- **JDK 17** for Maven. The scripts pick it automatically with `/usr/libexec/java_home -v 17`
  (this finds JDKs installed by IntelliJ too). Check: `/usr/libexec/java_home -v 17`.
  Java 24 is not used for the backend because the project targets 17 and its test libraries
  (Mockito/Byte Buddy in Spring Boot 3.2.5) predate Java 24.
- **Maven**. Check: `mvn -v`. If it's missing: `brew install maven`, or use IntelliJ's bundled
  copy: `"/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn"`.
- **Node 24 + npm 11**: fine as-is.
- `blockchain/node_modules` already installed (it is).

## Part A: stamping and hashing (no services needed)

```bash
cd "/Users/dhanushgowda/Desktop/kredent 2"
bash benchmarks/scripts/run-stamping-hashing.sh 3
```

Output: `benchmarks/results/<runId>/stamping-hashing/`

- `launch-N/stamping_hashing_raw.csv`: every iteration, every operation, in nanoseconds
- `launch-N/summary.json`, `fixtures.json`, `environment.json`
- `summary_pooled.json`: per size and operation, pooled across launches, plus per-launch stats

## Part B: verification (local stack, 5 terminals)

All commands from the repository root `"/Users/dhanushgowda/Desktop/kredent 2"`.

| Terminal | Command | Leave running? |
|---|---|---|
| 1 | `(cd benchmarks && npm install)` once, then `mvn -q -f benchmarks/local-db/pom.xml compile exec:java` | yes |
| 2 | `cd blockchain && npx hardhat node` | yes |
| 3 | `cd blockchain && npx hardhat run scripts/bench/deploy-local.js --network localhost` | no (one-off) |
| 3 | `node benchmarks/mock-storage/server.mjs` | yes |
| 4 | `bash benchmarks/scripts/start-backend-local.sh` (wait for "Started KredentBackendApplication") | yes |
| 5 | `cd benchmarks && node verification/seed.mjs --students=100 --revoke=20` | no |
| 5 | `node verification/run.mjs --seed=results/seed-<TAG>.json` (TAG is printed by the seed step) | no |

Notes:

- Run Part A first: the seed step uploads `benchmarks/fixtures/fixture-1MB.pdf`, which Part A generates.
- The Hardhat node is in-memory. If you restart it, re-run the deploy step, restart the backend,
  and seed again (the old seed's tokens no longer exist on the new chain).
- `npx hardhat` loads the existing `hardhat.config.js`, which reads `blockchain/.env` into memory
  as it always does. With `--network localhost` nothing from it is used, and nothing is sent to Amoy.
- The seed step sends transactions **only to the local Hardhat chain**, signed by that node's
  built-in public test account #0. No private key appears in any file here.
- `seed.mjs` uses unique USNs/emails per run (`--tag`), so it can be re-run without clashes.
- To start the database from scratch, stop terminal 1 and delete `benchmarks/.local-db-data/`.
  The error "could not lock ... epg-lock" means another copy is already running.

Output: `benchmarks/results/<runId>/verification/`

- `verification_single_raw.csv`, `onchain_read_raw.csv`, `verification_concurrency_raw.csv`
- `summary.json`, `environment.json`

Useful flags for `run.mjs`: `--only=single,onchain,concurrency`, `--warmup=30`,
`--iterations=500`, `--levels=10,50,100`, `--reps=3`, `--warmupSeconds=15`,
`--durationSeconds=60`, `--cooldownSeconds=5`, `--label=<name>`.

## Methodology

### Stamping and hashing

- **Code under test:** `PdfStampingService.stampQrCode(byte[], String)` and
  `HashUtil.sha256Hex(byte[])`, called directly in-process (no HTTP, DB, storage or network).
- **Fixtures:** single-page A4 PDFs built with PDFBox 2.0.31 (the app's own version): certificate
  text plus one embedded image of seeded random noise. Targets 100,000 / 1,000,000 / 5,000,000 bytes,
  each within ±1%. Exact sizes and SHA-256 are in `fixtures.json`. 5,000,000 bytes is under the app's
  5 MiB (5,242,880-byte) upload limit.
- **Operations, each timed separately** with `System.nanoTime()` around only that call:
  - `stamp`: `stampQrCode(pdf, url)`, including the QR generation it does internally, exactly as
    in production
  - `sha256`: `sha256Hex(stampedBytes)`, on the stamped output, which is what production hashes
  - `qr_generate`: `QrCodeUtil.generatePng(url)` alone, reported as a sub-component of stamping
- **URL:** `http://localhost:5173/verify/SKC-2026-XXXXXXXX`, unique per iteration, built outside the
  timed regions.
- **Iterations:** per size, 50 warm-up (recorded as `phase=warmup`, excluded from statistics) then
  300 measured. Repeated in 3 separate JVM launches; per-launch and pooled statistics are reported.
- **Dead-code protection:** all results feed a checksum printed at the end.
- **Known limitation:** this is a hand-written harness, not JMH (JMH would require a `pom.xml`
  change). Warm-up, multiple launches and raw-data publication are used to compensate.

### Verification

- **Endpoint under test:** the real `GET /api/verify/{certificateNumber}` on the unchanged backend
  (controller → `PublicVerificationService.verify` → JPA → `BlockchainVerificationService.readCredential`).
- **Environment:** backend, PostgreSQL 16, mock storage, Hardhat node and the load generator all on
  one machine. Backend started with `--spring.jpa.show-sql=false`; Tomcat thread pool and Hikari
  connection pool are left at defaults (200 threads, 10 connections).
- **Latency:** from just before `fetch()` until the full response body is read and parsed
  (`performance.now()`), measured by the Node 24 client.
- **Single-request test:** one request at a time, the three cases interleaved round-robin,
  30 warm-up + 500 measured per case:
  - `minted` → expects `VERIFIED`. **Includes the live on-chain read** (`eth_call getCredential`).
  - `revoked` → expects `REVOKED`. DB only: a revoked certificate returns before any chain read.
  - `unknown` → expects `INVALID`. DB only.
- **On-chain read on its own:** the same `eth_call getCredential(tokenId)` sent straight to the RPC,
  30 warm-up + 500 measured. Reported separately so the chain read's share of `minted` latency is visible.
- **Concurrency test:** closed loop, 10 / 50 / 100 workers, each sending the next request as soon as
  the previous one finishes, to a random MINTED certificate. 15 s warm-up, 60 s measured, 3 repetitions
  per level, 5 s cool-down. Only requests that **start** inside the measured window are counted.
  Throughput = successful requests ÷ 60 s.
- **Failure:** network error, HTTP status ≠ 200, or `result` ≠ the expected value (for example
  `UNAVAILABLE` when the chain read fails). Failures stay in the raw CSV and are counted, never dropped.
- **Caveat:** a local Hardhat RPC answers far faster than a real Amoy RPC provider, so on-chain read
  time here is a lower bound. A real-network comparison is a separate, approval-only step.

### Statistics (identical in Java and Node)

- **median:** middle value of the sorted samples (mean of the two middle values when n is even)
- **p95 / p99:** nearest-rank, the value at 1-based position ceil(p/100 × n) of the sorted samples
- **stddev:** sample standard deviation (n − 1)
