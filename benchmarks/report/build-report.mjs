// Builds the consolidated report from RECORDED result files only. Nothing is estimated: any
// section whose input files do not exist is rendered as "NOT MEASURED" with the reason.
// Usage: node report/build-report.mjs   ->  benchmarks/results/FINAL-REPORT/
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { BENCH_DIR } from '../lib/config.mjs'
import { summarize } from '../lib/stats.mjs'

const RES = path.join(BENCH_DIR, 'results')
const OUT = path.join(RES, 'FINAL-REPORT')
mkdirSync(OUT, { recursive: true })
const dirs = readdirSync(RES).filter((d) => statSync(path.join(RES, d)).isDirectory() && d !== 'FINAL-REPORT').sort()
const find = (suffix, filter = () => true) => dirs.filter((d) => existsSync(path.join(RES, d, suffix)) && filter(d)).map((d) => path.join(RES, d, suffix))
const latest = (arr) => arr.at(-1)
const readJ = (p) => JSON.parse(readFileSync(p, 'utf8'))
const f = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? 'n/a' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
const i0 = (v) => (v === null || v === undefined ? 'n/a' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }))
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
const rel = (p) => path.relative(BENCH_DIR, p)
const NM = (why) => `**NOT MEASURED** — ${why}`

const S = { sources: {} }
const md = []
const H = (s) => md.push(`\n${s}\n`)

// ---------- inputs
const stampP = latest(find('stamping-hashing/summary_pooled.json'))
const verP = latest(find('verification/summary.json'))
const gasP = latest(find('contract-level/summary.json', (d) => d.includes('gas-security')))
const batchPs = find('contract-level/summary.json', (d) => d.includes('batch-') && !d.includes('smoke'))
const issP = latest(find('issuance/summary.json'))
const secP = latest(find('security/security_results.json'))
S.sources = { stampP, verP, gasP, batchPs, issP, secP }

md.push('# Kredent — Performance Benchmarking and Testing Report')
md.push(`Generated ${new Date().toISOString()} from recorded result files in \`benchmarks/results/\`. Every number below is read from a raw CSV/JSON produced by an executed test; sections without data say so.`)
md.push('> **Read this first.** All numbers are **local-machine measurements** (loopback networking, local PostgreSQL, local Hardhat chain, mock object storage). They are *not* production or Polygon Amoy performance and must be labelled that way in the report. Execution hosts differ between sections; each section states its host.')

// ---------- 1 stamping/hashing
H('## 1. PDF stamping and SHA-256 hashing (Section 5.2 / Table 4 input)')
if (stampP) {
  const d = readJ(stampP)
  const fx = existsSync(path.join(path.dirname(stampP), 'launch-1', 'fixtures.json')) ? readJ(path.join(path.dirname(stampP), 'launch-1', 'fixtures.json')) : null
  S.stamping = d.results
  md.push(`Source: \`${rel(stampP)}\` — real \`PdfStampingService.stampQrCode()\` and \`HashUtil.sha256Hex()\`, in-process, 50 warm-up + 300 measured runs per size, 3 separate JVM launches (pooled n = 900 per cell). Times in ms. Host: native macOS (Apple M1).`)
  const rows = []
  for (const size of Object.keys(d.results)) for (const [op, label] of [['stamp_ms', 'PDF stamping'], ['sha256_ms', 'SHA-256 hashing'], ['qr_generate_ms', '(sub-component) QR generation']]) {
    const s = d.results[size][op]?.pooled
    if (s) rows.push([size, label, i0(s.n), f(s.min, 3), f(s.max, 3), f(s.mean, 3), f(s.median, 3), f(s.p95, 3), f(s.stddev, 3)])
  }
  md.push(table(['PDF size', 'Operation', 'n', 'Min', 'Max', 'Mean', 'Median', 'p95', 'Std dev'], rows))
  md.push('\nPer-launch medians (stamping, ms) show run-to-run stability:')
  md.push(table(['PDF size', 'Launch 1', 'Launch 2', 'Launch 3'], Object.keys(d.results).map((s) => [s, ...['launch-1', 'launch-2', 'launch-3'].map((l) => f(d.results[s].stamp_ms?.perLaunch?.[l]?.median, 3))])))
  if (fx) md.push(`\nFixture details: \`${rel(path.join(path.dirname(stampP), 'launch-1', 'fixtures.json'))}\`. Raw per-iteration data: \`${rel(path.dirname(stampP))}/launch-*/stamping_hashing_raw.csv\` (nanoseconds).`)
} else md.push(NM('no stamping/hashing results found.'))

// ---------- 2 issuance / revocation
H('## 2. Certificate issuance and revocation latency')
md.push('Phase coverage — what was and was not measured:')
const issRowsStatus = [
  ['A', 'PDF stamping', 'Measured in-process (Section 1). Not separable over HTTP without changing the app.'],
  ['B', 'SHA-256 hashing', 'Measured in-process (Section 1).'],
  ['C', 'Backend metadata + DB', issP ? 'Measured over HTTP (below).' : NM('needs the local backend stack on the Mac; see "Remaining measurements".')],
  ['D', 'File upload', issP ? 'Measured as part of the upload request U (network transfer to localhost + validation + A + B + mock-storage upload + DB).' : NM('as above.')],
  ['E', 'MetaMask signing + confirmation', 'NOT MEASURED with MetaMask. MetaMask is a browser extension needing a human click; it was not automated. ' + (issP ? 'Measured instead: Hardhat unlocked-account sign+submit (E1) and instant automine confirmation (E2). These are NOT MetaMask or Amoy times.' : 'Contract-level per-transaction time is in Section 5.')],
  ['F', 'Backend receipt verification', issP ? 'Measured over HTTP (below).' : NM('as above.')],
  ['G', 'End-to-end', issP ? 'Measured as C+U+E1+E2+F wall clock, **excluding** MetaMask and human time. Do not quote it as true end-to-end.' : NM('as above.')],
]
md.push(table(['Phase', 'Name', 'Status'], issRowsStatus))
if (issP) {
  const d = readJ(issP)
  S.issuance = d.bySize
  md.push(`\nSource: \`${rel(issP)}\` (local stack; signer = Hardhat unlocked test account, not MetaMask). Times in ms; statistics over successful measured iterations.`)
  const mk = (keys) => Object.entries(d.bySize).flatMap(([size, v]) => keys.map(([k, label]) => [size, label, i0(v.successful) + '/' + i0(v.measuredAttempts), f(v[k].median), f(v[k].p95), f(v[k].mean), f(v[k].min), f(v[k].max), f(v[k].stddev)]))
  md.push('\n**Issuance**\n')
  md.push(table(['PDF', 'Phase', 'ok/attempts', 'Median', 'p95', 'Mean', 'Min', 'Max', 'Std dev'], mk([['C_metadata_ms', 'C metadata+DB'], ['U_upload_ms', 'U upload (A+B+D+DB)'], ['E1_sign_submit_ms', 'E1 sign+submit (Hardhat)'], ['E2_confirm_ms', 'E2 confirm (automine)'], ['F_receipt_verify_ms', 'F receipt verify+DB'], ['G_issue_total_ms', 'G total (no MetaMask)']])))
  md.push('\n**Revocation**\n')
  md.push(table(['PDF', 'Phase', 'ok/attempts', 'Median', 'p95', 'Mean', 'Min', 'Max', 'Std dev'], mk([['R_E1_sign_submit_ms', 'E1 sign+submit (Hardhat)'], ['R_E2_confirm_ms', 'E2 confirm (automine)'], ['R_F_receipt_verify_ms', 'F receipt verify+DB'], ['R_G_revoke_total_ms', 'G total (no MetaMask)']])))
}

// ---------- 3 verification
H('## 3. Public verification — single-request latency')
let ver = null
if (verP) {
  ver = readJ(verP); S.verification = ver.results
  const env = existsSync(path.join(path.dirname(verP), 'environment.json')) ? readJ(path.join(path.dirname(verP), 'environment.json')) : {}
  md.push(`Source: \`${rel(verP)}\` — real \`GET /api/verify/{certificateNumber}\` on the unchanged backend, local PostgreSQL 16, local Hardhat chain, ~${(env.mintedPool ?? 0) + (env.revokedPool ?? 0)} fake certificates (${env.mintedPool} minted + ${env.revokedPool} revoked). One request at a time; 30 warm-up + 500 measured per case. Host: native macOS (Apple M1). Latency = client-side \`performance.now()\` from before \`fetch()\` until the body is parsed.`)
  const rows = Object.entries(ver.results.single).map(([c, v]) => {
    const s = v.latency_ms_all
    return [c + (v.includesOnChainRead ? ' (DB + on-chain read)' : ' (DB only)'), v.expected, i0(s.n), f(s.min), f(s.max), f(s.mean), f(s.median), f(s.p95), f(s.stddev), `${v.failures} (${f(v.failureRate * 100, 2)}%)`]
  })
  const o = ver.results.onchainReadDirect.latency_ms_successful
  rows.push(['Direct on-chain read (eth_call to Hardhat, no backend)', '—', i0(o.n), f(o.min), f(o.max), f(o.mean), f(o.median), f(o.p95), f(o.stddev), `${ver.results.onchainReadDirect.failures}`])
  md.push(table(['Case', 'Expected', 'n', 'Min', 'Max', 'Mean', 'Median', 'p95', 'Std dev', 'Failures'], rows))
  const m = ver.results.single.minted.latency_ms_all.median, u = ver.results.single.unknown.latency_ms_all.median
  md.push(`\nComponent split (medians, ms): complete API response for a minted certificate ${f(m)}; DB-only path (unknown certificate) ${f(u)}; direct local-chain read ${f(o.median)}. The remainder (${f(m - u - o.median)} ms = minted − DB-only − chain read) is the web3j call overhead, JSON mapping and the extra lookup work. This is a **derived** split, not a server-side trace; the backend has no per-stage timing and was not instrumented.`)

  H('## 4. Concurrency and throughput (`GET /api/verify/{n}`, minted certificates)')
  md.push(`Closed-loop workers (no think time), random minted certificate per request; ${ver.parameters.warmupSeconds} s warm-up discarded, ${ver.parameters.durationSeconds} s measured, ${ver.parameters.reps} repetitions per level. Throughput = successful requests ÷ ${ver.parameters.durationSeconds} s. Failure = network error, non-200, or result ≠ VERIFIED.`)
  const crow = []
  for (const [lv, v] of Object.entries(ver.results.concurrency)) {
    for (const r of v.repetitions) { const s = r.latency_ms_all; crow.push([lv, `rep ${r.repetition}`, i0(r.total), `${i0(r.failures)} (${f(r.failureRate * 100, 3)}%)`, f(r.throughput_rps_successful, 1), f(s.min), f(s.max), f(s.mean), f(s.median), f(s.p95), f(s.stddev)]) }
    const rs = v.repetitions
    const tot = rs.reduce((a, r) => a + r.total, 0), fl = rs.reduce((a, r) => a + r.failures, 0)
    crow.push([`**${lv}**`, '**mean of reps**', i0(tot), `${i0(fl)} (${f((fl / tot) * 100, 3)}%)`, `**${f(v.mean_throughput_rps_successful, 1)}**`, f(Math.min(...rs.map((r) => r.latency_ms_all.min))), f(Math.max(...rs.map((r) => r.latency_ms_all.max))), f(summarize(rs.map((r) => r.latency_ms_all.mean)).mean), `**${f(summarize(rs.map((r) => r.latency_ms_all.median)).mean)}**`, f(summarize(rs.map((r) => r.latency_ms_all.p95)).mean), '—'])
  }
  md.push(table(['Concurrency', 'Run', 'Requests', 'Failed', 'Throughput (req/s)', 'Min ms', 'Max ms', 'Mean ms', 'Median ms', 'p95 ms', 'Std dev'], crow))
  md.push('\n"mean of reps" rows average the three per-repetition values (median-of-medians style); per-repetition rows are the primary data. Raw per-request data: `' + rel(path.join(path.dirname(verP), 'verification_concurrency_raw.csv')) + '` (~110 MB).')
} else { md.push(NM('no verification results found.')); H('## 4. Concurrency and throughput'); md.push(NM('as above.')) }

// ---------- 5 batch
H('## 5. Batch issuance scalability — CONTRACT-LEVEL ONLY')
md.push('> **Not the production application workflow.** The real flow needs MetaMask signing in the browser plus backend receipt verification per certificate, which cannot be batch-automated without changing the architecture. These results call the real `SkillChainCredential` bytecode directly on a local Hardhat node with its unlocked test account #0, one transaction at a time (send, then wait for the receipt). Hardhat auto-mines instantly, so times exclude Polygon block time (~2 s each on Amoy). Host: Linux aarch64 VM (4 vCPU, 3.9 GiB) on the MacBook, Node v22 — **different host from Sections 1, 3, 4**.')
let batchRuns = []
for (const p of batchPs) batchRuns.push(...(readJ(p).batch?.runs ?? []))
if (batchRuns.length) {
  const sizes = [...new Set(batchRuns.map((r) => r.batch_size))].sort((a, b) => a - b)
  const rows = [], bySize = []
  for (const size of sizes) {
    const rs = batchRuns.filter((r) => r.batch_size === size).sort((a, b) => a.rep - b.rep)
    for (const r of rs) rows.push([i0(size), `rep ${r.rep}`, f(r.total_ms / 1000, 2), f(r.avg_ms_per_certificate, 2), i0(r.successful), i0(r.failed), f(r.failure_pct, 2) + '%', i0(r.total_gas), f(r.avg_gas_per_certificate, 2), f(r.throughput_certs_per_s, 2)])
    const ok = rs.reduce((a, r) => a + r.successful, 0), fail = rs.reduce((a, r) => a + r.failed, 0), gas = rs.reduce((a, r) => a + r.total_gas, 0)
    const tm = summarize(rs.map((r) => r.total_ms)).median
    rows.push([`**${i0(size)}**`, '**median of reps** (counts summed over reps)', `**${f(tm / 1000, 2)}**`, `**${f(summarize(rs.map((r) => r.avg_ms_per_certificate)).median, 2)}**`, i0(ok), i0(fail), f((fail / (ok + fail)) * 100, 2) + '%', '—', `**${f(gas / ok, 2)}**`, f(summarize(rs.map((r) => r.throughput_certs_per_s)).median, 2)])
    bySize.push({ size, reps: rs.length, total_s_median: tm / 1000, avg_ms_median: summarize(rs.map((r) => r.avg_ms_per_certificate)).median, successful: ok, failed: fail, avg_gas: gas / ok })
  }
  S.batch = bySize
  md.push(table(['Batch size', 'Run', 'Total time (s)', 'Avg per certificate (ms)', 'Successful', 'Failed', 'Failure %', 'Total gas', 'Avg gas / certificate', 'Certs / s'], rows))
  md.push('\nSources: ' + batchPs.map((p) => '`' + rel(p) + '`').join(', ') + '. Raw per-transaction data: `batch_raw.csv` next to each summary. Every run starts on a freshly deployed contract; `totalIssued()` was read back after each run and equalled the successful count.')
} else md.push(NM('no batch results found.'))

// ---------- 6 gas
H('## 6. Blockchain gas consumption and verification of previously recorded values')
if (gasP) {
  const g = readJ(gasP).gas; S.gas = g
  const sens = g.revokeGasByReasonLength
  const impliedGwei = (0.0068 * 1e18) / 241948 / 1e9
  md.push('New measurements: **local Hardhat** (gas units are deterministic for identical bytecode/arguments; they do not depend on host speed). Previously recorded values are labelled **Polygon Amoy (historical, user-supplied)**; no Amoy receipts exist in the repository, so those could not be re-checked on-chain and **no Amoy transaction was sent**.')
  md.push(table(['Quantity', 'Previously recorded (Amoy)', 'New local Hardhat', 'Status'], [
    ['Deployment gas', '1,106,265', `${i0(g.deployment.median)} (5 deployments, all identical)`, g.deployment.median === 1106265 ? '**Match (exact)**' : 'Differs'],
    ['issueCredential() gas', '241,948', `median ${i0(g.issueCredential.median)}; mean ${f(g.issueCredential.mean, 1)}; min ${i0(g.issueCredential.min)}; max ${i0(g.issueCredential.max)} (n=${g.issueCredential.n}; 36-char UUID id, 64-char hash)`, g.issueCredential.median === 241948 ? '**Match (exact median)**' : 'Differs'],
    ['revokeCredential() gas', '73,640', `${i0(g.revokeCredential.median)} with a ${g.revokeCredential.reasonLength}-char reason (n=${g.revokeCredential.n})`, 'Value depends on reason length — see below. **Not reproduced with this reason; requires confirmation of the original reason text.**'],
    ['Gas per certificate, batch 100 / 500 / 1,000', '≈ 241,947', batchRuns.length ? [100, 500, 1000].map((s) => { const rs = batchRuns.filter((r) => r.batch_size === s); return rs.length ? f(rs.reduce((a, r) => a + r.total_gas, 0) / rs.reduce((a, r) => a + r.successful, 0), 2) : 'n/a' }).join(' / ') : 'n/a', 'Consistent (rounds to 241,947)'],
    ['Issuance fee ≈ 0.0068 POL', '0.0068 POL', 'Not measurable locally (Hardhat gas price is simulated)', `**Requires confirmation.** 0.0068 POL ÷ 241,948 gas implies ≈ ${f(impliedGwei, 1)} gwei; verify against the Amoy transaction receipt/explorer.`],
  ]))
  md.push('\nRevocation gas versus reason-string length (local Hardhat, single transaction each): ' + sens.map((s) => `${s.reason_len} chars → ${i0(s.gasUsed)}`).join('; ') + '. A reason of roughly 10–20 characters gives ≈ 73.6–73.7 k, so the recorded 73,640 is consistent with a short reason, but that is an inference, not a verification.')
} else md.push(NM('no gas results found.'))

// ---------- 7 adversarial
H('## 7. Adversarial and security tests')
const all = []
if (gasP) { const sec = readJ(gasP).security; for (const t of sec.tests) all.push({ layer: 'Contract (local Hardhat)', ...t }) }
if (secP) { const sec = readJ(secP); for (const t of sec.tests) all.push({ layer: 'Application (HTTP, local stack)', ...t }) }
S.securityTotals = { total: all.length, passed: all.filter((t) => t.result === 'PASS').length }
if (all.length) {
  md.push(table(['ID', 'Layer', 'Test case', 'Expected', 'Actual', 'Result', 'Evidence / note'], all.map((t) => [t.id, t.layer, t.name, t.expected, String(t.actual).replace(/\|/g, '/'), t.result === 'PASS' ? '**PASS**' : '**FAIL**', (String(t.evidence ?? '') + (t.note ? ' — ' + t.note : '')).replace(/\|/g, '/').slice(0, 220)])))
  const byLayer = [...new Set(all.map((t) => t.layer))].map((l) => `${l}: ${all.filter((t) => t.layer === l && t.result === 'PASS').length}/${all.filter((t) => t.layer === l).length} passed`)
  md.push('\n**Totals** — ' + byLayer.join('; ') + `; combined ${S.securityTotals.passed}/${S.securityTotals.total}.`)
}
if (!secP) md.push('\n' + NM('the HTTP-level application security tests (JWT, role-based access, tampered PDF, revoked certificate, duplicate issuance, bad transaction references) have not been executed yet. The script is written (`benchmarks/security/run.mjs`) and needs the local backend stack running on the Mac. The contract-level tests above were executed.'))

// ---------- 8 environment
H('## 8. System environment')
md.push(table(['Item', 'Sections 1, 3, 4 (native Mac)', 'Sections 5, 6, contract-level 7 (Linux VM on the same Mac)'], [
  ['Machine', 'MacBook with Apple M1 (8 cores: 4 performance + 4 efficiency); exact model name not captured — confirm in About This Mac', 'Linux aarch64 VM, 4 vCPU'],
  ['RAM', '8 GiB', '3.9 GiB (VM allocation)'],
  ['OS', 'macOS 15.5 (build 24F74)', 'Linux 6.8 (Ubuntu 22.04 userland)'],
  ['Java', 'OpenJDK 17.0.19 (Microsoft build), max heap 2 GiB', 'Not used'],
  ['Maven', '3.9.14', 'Not used'],
  ['Node.js / npm', 'v24.8.0 / 11.19.0', 'v22.23.4 / 10.9.9'],
  ['PostgreSQL', '16 (embedded binaries via Maven, 127.0.0.1:54329) — version string from benchmarks/README; confirm with `select version()`', 'Not used'],
  ['Hardhat', '2.29.0 (in-process node, 127.0.0.1:8545, chain 31337)', '2.29.0 (scratch install, 127.0.0.1:8545, chain 31337)'],
  ['Solidity', '0.8.20, optimizer 200 runs, EVM paris (existing compiled artifact)', 'same artifact'],
  ['Network type', 'Loopback only (127.0.0.1); no external network in the timed path', 'Loopback only'],
  ['Network bandwidth', 'Not measured: all traffic is loopback, so bandwidth is not a meaningful limit', 'Not measured'],
  ['RPC provider', 'None (local Hardhat node)', 'None (local Hardhat node)'],
  ['Power state', 'Stage-1 start log shows battery power, 29 % and discharging — a limitation (possible CPU throttling)', 'n/a'],
  ['Git commit', 'f3882c04e5f3b5a589731d90df6c8d90ce939dce (working tree contains untracked benchmark files only)', 'same'],
]))

// ---------- methodology
H('## 9. Methodology, formulas and limitations')
md.push(`**Statistics** (identical in Java and Node): median = middle sorted value (mean of the two middle values for even n); p95 = nearest-rank, value at 1-based position ceil(0.95·n); standard deviation = sample (n−1); mean = arithmetic. Throughput = successful requests ÷ measured seconds. Failure % = failed ÷ attempted × 100. Gas per certificate = Σ gasUsed ÷ successful issuances.

**Safety**: every script refuses non-local RPC/API URLs and requires chain ID 31337; only public Hardhat test accounts are used; no production Supabase, no Polygon Amoy transaction, no change to \`pom.xml\`, \`application.properties\`, \`.env\` or Hardhat config.

**Limitations**
- Local loopback numbers exclude real network, Supabase and Amoy latency; they are lower bounds, not production performance.
- Sections 1/3/4 ran on the native Mac; Sections 5/6 and the contract-level security tests ran in a Linux VM on the same machine because the backend toolchain (JDK 17/Maven) could not be installed in the VM. Do not compare absolute times across those hosts.
- The batch test is sequential single-account issuance with instant automine; it is not representative of Amoy throughput or of MetaMask-signed application issuance.
- MetaMask signing/confirmation was not measured. Backend-only time is not end-to-end time.
- The hand-written Java harness is not JMH; warm-up, multiple JVM launches and raw-data publication are used to compensate.
- Stage-1 battery power (29 %) may have affected absolute timings.
- DB time here is a local PostgreSQL; Supabase would add network round trips.`)

// ---------- abstract
H('## 10. Values that can go in the abstract (with honest labels)')
const abs = []
if (ver) {
  const m = ver.results.single.minted.latency_ms_all
  abs.push(['Median public verification latency', `${f(m.median)} ms (p95 ${f(m.p95)} ms), single request, minted certificate incl. live on-chain read`, 'Local machine, local DB and local Hardhat chain. Not production.'])
  const c = ver.results.concurrency
  abs.push(['Verification under concurrency', Object.entries(c).map(([lv, v]) => `${lv} workers: ${i0(v.mean_throughput_rps_successful)} req/s, median ${f(summarize(v.repetitions.map((r) => r.latency_ms_all.median)).mean, 1)} ms, ${v.repetitions.reduce((a, r) => a + r.failures, 0)} failures`).join('; '), 'Closed-loop, 3×60 s per level, local machine.'])
}
if (gasP) { const g = readJ(gasP).gas; abs.push(['Gas', `deployment ${i0(g.deployment.median)}; issueCredential ${i0(g.issueCredential.median)}; revokeCredential ${i0(g.revokeCredential.median)} (38-char reason; historical Amoy figure 73,640 needs confirmation)`, 'Deployment and issue gas verified on local Hardhat; fee in POL requires confirmation.']) }
abs.push(['Median certificate issuance latency', issP ? 'See Section 2 (no MetaMask)' : '**Not available yet** — needs the application-level run. Do not substitute the contract-level 66 ms/tx figure.', issP ? 'Excludes MetaMask and Amoy confirmation.' : '—'])
abs.push(['Adversarial tests passed', all.length ? `${S.securityTotals.passed} of ${S.securityTotals.total} executed${secP ? '' : ' (contract-level only; application-level tests pending)'}` : 'none executed', secP ? 'Combined contract + application layers.' : 'Do not quote as the full security result until the HTTP tests have run.'])
md.push(table(['Abstract item', 'Value', 'Required qualifier'], abs))

writeFileSync(path.join(OUT, 'Kredent_Performance_Report.md'), md.join('\n\n') + '\n')
writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), ...S }, null, 2) + '\n')
console.log('Report written to', rel(OUT))
