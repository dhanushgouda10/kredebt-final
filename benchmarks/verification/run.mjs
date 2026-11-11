// Verification benchmarks against the REAL backend endpoint GET /api/verify/{certificateNumber},
// on the local stack only (local Postgres, mock storage, local Hardhat chain).
//
// Tests (choose with --only=single,onchain,concurrency; default runs all three):
//   single       One request at a time, cases interleaved round-robin:
//                  minted  -> DB lookup + LIVE on-chain read (eth_call getCredential) -> VERIFIED
//                  revoked -> DB lookup only (REVOKED returns before any chain read)
//                  unknown -> DB lookup only (no such certificate -> INVALID)
//   onchain      The same getCredential eth_call sent straight to the RPC, with no backend, so
//                the on-chain read's own cost can be reported separately.
//   concurrency  Closed-loop workers (no think time) hitting random MINTED certificates at each
//                level in --levels, after a warm-up, repeated --reps times.
//
// Latency = time from just before fetch() until the full response body has been read and parsed.
// A sample is a FAILURE if: network error, HTTP status != 200, or result != the expected value.
//
// Usage: node verification/run.mjs --seed=results/seed-<TAG>.json [--label=x] [--only=...]
//        [--warmup=30] [--iterations=500] [--levels=10,50,100] [--reps=3]
//        [--warmupSeconds=15] [--durationSeconds=60] [--cooldownSeconds=5]

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ethers } from 'ethers'
import { config, parseArgs, readContractAbi, BENCH_DIR } from '../lib/config.mjs'
import { assertLocalChain } from '../lib/guards.mjs'
import { summarize } from '../lib/stats.mjs'
import { ensureDir, writeJson, csvWriter, environment, runId } from '../lib/output.mjs'

const args = parseArgs()
if (!args.seed) throw new Error('Pass --seed=results/seed-<TAG>.json (written by verification/seed.mjs)')
const only = new Set((args.only ?? 'single,onchain,concurrency').split(','))
const P = {
  warmup: Number(args.warmup ?? 30),
  iterations: Number(args.iterations ?? 500),
  levels: (args.levels ?? '10,50,100').split(',').map(Number),
  reps: Number(args.reps ?? 3),
  warmupSeconds: Number(args.warmupSeconds ?? 15),
  durationSeconds: Number(args.durationSeconds ?? 60),
  cooldownSeconds: Number(args.cooldownSeconds ?? 5),
}

const seed = JSON.parse(readFileSync(path.resolve(BENCH_DIR, args.seed), 'utf8'))
const RUN_ID = runId(args.label ?? 'verification')
const OUT = ensureDir(path.join(config.resultsDir, RUN_ID, 'verification'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

async function verifyOnce(certificateNumber, expected) {
  const start = performance.now()
  const startMs = Date.now()
  try {
    const res = await fetch(`${config.apiBase}/api/verify/${encodeURIComponent(certificateNumber)}`)
    const body = await res.json().catch(() => null)
    const latencyMs = performance.now() - start
    const result = body?.result ?? ''
    const ok = res.status === 200 && result === expected
    return { startMs, latencyMs, status: res.status, result, ok, error: ok ? '' : `expected ${expected}` }
  } catch (e) {
    return { startMs, latencyMs: performance.now() - start, status: 0, result: '', ok: false, error: e.message }
  }
}

function summarizeSamples(samples) {
  const ok = samples.filter((s) => s.ok)
  return {
    latency_ms_successful: summarize(ok.map((s) => s.latencyMs)),
    latency_ms_all: summarize(samples.map((s) => s.latencyMs)),
    total: samples.length,
    failures: samples.length - ok.length,
    failureRate: samples.length ? (samples.length - ok.length) / samples.length : 0,
  }
}

async function single() {
  const cases = [
    { name: 'minted', expected: 'VERIFIED', includesOnChainRead: true, numbers: seed.minted.map((c) => c.certificateNumber) },
    { name: 'revoked', expected: 'REVOKED', includesOnChainRead: false, numbers: seed.revoked.map((c) => c.certificateNumber) },
    { name: 'unknown', expected: 'INVALID', includesOnChainRead: false, numbers: ['SKC-2026-BENCH000'] },
  ].filter((c) => c.numbers.length > 0)
  const w = csvWriter(path.join(OUT, 'verification_single_raw.csv'),
    ['run_id', 'case', 'includes_onchain_read', 'phase', 'iteration', 'certificate_number', 'start_epoch_ms', 'latency_ms', 'http_status', 'result', 'ok', 'error'])
  const samples = Object.fromEntries(cases.map((c) => [c.name, []]))
  for (let i = 0; i < P.warmup + P.iterations; i++) {
    const phase = i < P.warmup ? 'warmup' : 'measure'
    for (const c of cases) {
      const number = pick(c.numbers)
      const s = await verifyOnce(number, c.expected)
      w.row({ run_id: RUN_ID, case: c.name, includes_onchain_read: c.includesOnChainRead, phase,
        iteration: phase === 'warmup' ? i + 1 : i - P.warmup + 1, certificate_number: number,
        start_epoch_ms: s.startMs, latency_ms: s.latencyMs.toFixed(3), http_status: s.status, result: s.result, ok: s.ok, error: s.error })
      if (phase === 'measure') samples[c.name].push(s)
    }
  }
  await w.close()
  const out = {}
  for (const c of cases) out[c.name] = { expected: c.expected, includesOnChainRead: c.includesOnChainRead, ...summarizeSamples(samples[c.name]) }
  console.log('[single] done')
  return out
}

async function onchain() {
  const iface = new ethers.Interface(readContractAbi())
  const tokens = seed.minted.map((c) => c.tokenId)
  const w = csvWriter(path.join(OUT, 'onchain_read_raw.csv'),
    ['run_id', 'phase', 'iteration', 'token_id', 'start_epoch_ms', 'latency_ms', 'ok', 'error'])
  const lat = []
  let failures = 0
  for (let i = 0; i < P.warmup + P.iterations; i++) {
    const phase = i < P.warmup ? 'warmup' : 'measure'
    const tokenId = pick(tokens)
    // Same JSON-RPC call the backend's web3j client makes: eth_call getCredential(tokenId) at "latest".
    const payload = JSON.stringify({ jsonrpc: '2.0', id: i, method: 'eth_call',
      params: [{ to: seed.contractAddress, data: iface.encodeFunctionData('getCredential', [tokenId]) }, 'latest'] })
    const startMs = Date.now()
    const start = performance.now()
    let ok = false
    let error = ''
    try {
      const res = await fetch(config.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload })
      const body = await res.json()
      ok = res.status === 200 && typeof body.result === 'string' && body.result.length > 2
      if (!ok) error = body.error?.message ?? `HTTP ${res.status}`
    } catch (e) {
      error = e.message
    }
    const latencyMs = performance.now() - start
    w.row({ run_id: RUN_ID, phase, iteration: phase === 'warmup' ? i + 1 : i - P.warmup + 1, token_id: tokenId,
      start_epoch_ms: startMs, latency_ms: latencyMs.toFixed(3), ok, error })
    if (phase === 'measure') {
      if (ok) lat.push(latencyMs)
      else failures++
    }
  }
  await w.close()
  console.log('[onchain] done')
  return { latency_ms_successful: summarize(lat), failures }
}

async function concurrency() {
  const numbers = seed.minted.map((c) => c.certificateNumber)
  const w = csvWriter(path.join(OUT, 'verification_concurrency_raw.csv'),
    ['run_id', 'level', 'repetition', 'worker', 'seq', 'certificate_number', 'start_epoch_ms', 'latency_ms', 'http_status', 'result', 'ok', 'error'])
  const out = {}
  for (const level of P.levels) {
    out[level] = { repetitions: [] }
    for (let rep = 1; rep <= P.reps; rep++) {
      const t0 = Date.now()
      const measureStart = t0 + P.warmupSeconds * 1000
      const measureEnd = measureStart + P.durationSeconds * 1000
      const measured = []
      let warmupCount = 0
      const worker = async (id) => {
        let seq = 0
        while (Date.now() < measureEnd) {
          const number = pick(numbers)
          const s = await verifyOnce(number, 'VERIFIED')
          // Only requests that STARTED inside the measurement window are counted.
          if (s.startMs >= measureStart && s.startMs < measureEnd) {
            seq++
            measured.push(s)
            w.row({ run_id: RUN_ID, level, repetition: rep, worker: id, seq, certificate_number: number,
              start_epoch_ms: s.startMs, latency_ms: s.latencyMs.toFixed(3), http_status: s.status, result: s.result, ok: s.ok, error: s.error })
          } else if (s.startMs < measureStart) {
            warmupCount++
          }
        }
      }
      await Promise.all(Array.from({ length: level }, (_, i) => worker(i + 1)))
      const ok = measured.filter((s) => s.ok).length
      const summary = {
        repetition: rep,
        warmupRequestsDiscarded: warmupCount,
        measuredSeconds: P.durationSeconds,
        throughput_rps_successful: ok / P.durationSeconds,
        ...summarizeSamples(measured),
      }
      out[level].repetitions.push(summary)
      console.log(`[concurrency] level=${level} rep=${rep} ok=${ok} failures=${measured.length - ok} rps=${summary.throughput_rps_successful.toFixed(1)}`)
      await sleep(P.cooldownSeconds * 1000)
    }
    // Pooled view across repetitions, computed from the same raw samples' summaries.
    const reps = out[level].repetitions
    out[level].mean_throughput_rps_successful = reps.reduce((s, r) => s + r.throughput_rps_successful, 0) / reps.length
  }
  await w.close()
  return out
}

async function main() {
  await assertLocalChain(config.rpcUrl)
  writeJson(path.join(OUT, 'environment.json'), environment({
    runId: RUN_ID, apiBase: config.apiBase, rpc: 'local Hardhat node (chain 31337)', seedTag: seed.tag,
    mintedPool: seed.minted.length, revokedPool: seed.revoked.length, parameters: P,
    latencyDefinition: 'performance.now() before fetch() until the response body is fully read and parsed',
    failureDefinition: 'network error, HTTP status != 200, or result != expected (VERIFIED / REVOKED / INVALID)',
    percentileMethod: 'nearest-rank: value at position ceil(p/100*n) of sorted samples',
  }))
  const results = {}
  if (only.has('single')) results.single = await single()
  if (only.has('onchain')) results.onchainReadDirect = await onchain()
  if (only.has('concurrency')) results.concurrency = await concurrency()
  writeJson(path.join(OUT, 'summary.json'), { runId: RUN_ID, parameters: P, results })
  console.log(`[verification] results written to ${OUT}`)
}

main().catch((e) => {
  console.error('[verification] failed:', e.message)
  process.exitCode = 1
})
