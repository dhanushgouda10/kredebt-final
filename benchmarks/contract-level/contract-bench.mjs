// Contract-level benchmark of the REAL SkillChainCredential bytecode on a LOCAL Hardhat node.
// Covers: deployment gas, issueCredential/revokeCredential gas, batch issuance (100/500/1000),
// and contract-level security tests.
//
// IMPORTANT (state this in the report): this is NOT the production application workflow.
// It calls the contract directly with the Hardhat node's built-in unlocked test accounts
// (standing in for MetaMask signing). It does not involve the Spring Boot backend, PostgreSQL,
// PDF stamping, storage, JWT, or MetaMask. Hardhat automines each transaction instantly, so
// "confirmation" time here is NOT comparable with Polygon Amoy block times (~2 s).
//
// Safety: refuses to run unless BENCH_RPC_URL is localhost and eth_chainId == 31337. Uses only
// public Hardhat test accounts (signing happens inside the node). Deploys its OWN fresh
// contract instances; it never touches benchmarks/.local-chain.json or any other deployment.
//
// Usage: node contract-level/contract-bench.mjs [--sizes=100,500,1000] [--reps=3]
//        [--gasSamples=30] [--only=gas,batch,security] [--label=<name>]

import { readFileSync, existsSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { ethers } from 'ethers'
import { config, parseArgs, REPO_DIR } from '../lib/config.mjs'
import { assertLocalChain } from '../lib/guards.mjs'
import { summarize } from '../lib/stats.mjs'
import { csvWriter, ensureDir, writeJson, environment, runId } from '../lib/output.mjs'

const args = parseArgs()
const SIZES = (args.sizes ?? '100,500,1000').split(',').map(Number)
const REPS = Number(args.reps ?? 3)
const REP_START = Number(args.repStart ?? 1)
const GAS_SAMPLES = Number(args.gasSamples ?? 30)
const ONLY = new Set((args.only ?? 'gas,batch,security').split(','))
const RUN_ID = runId(args.label ?? 'contract')
const OUT = ensureDir(path.join(config.resultsDir, RUN_ID, 'contract-level'))

const artifact = JSON.parse(readFileSync(path.join(REPO_DIR, 'blockchain', 'artifacts', 'contracts', 'SkillChainCredential.sol', 'SkillChainCredential.json'), 'utf8'))
const REASON = 'Benchmark revocation (local test data)'

const provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, { staticNetwork: true, pollingInterval: 10 })
provider.pollingInterval = 10

function sha256Hex(buf) { return createHash('sha256').update(buf).digest('hex') }
function walletFor(i) { return ethers.getAddress('0x' + createHash('sha256').update('bench-student-' + i).digest('hex').slice(0, 40)) }
function errText(e) { return String(e?.reason ?? e?.shortMessage ?? e?.message ?? e).replace(/\s+/g, ' ').slice(0, 240) }

async function deploy(signer) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
  const t0 = performance.now()
  const c = await factory.deploy()
  const receipt = await c.deploymentTransaction().wait()
  const ms = performance.now() - t0
  return { contract: c, gasUsed: Number(receipt.gasUsed), ms, address: await c.getAddress() }
}

async function gasSection(issuer) {
  const rows = []
  const deployGas = []
  for (let i = 0; i < 5; i++) deployGas.push((await deploy(issuer)).gasUsed)
  const { contract } = await deploy(issuer)
  const issueGas = [], revokeGas = []
  const tokenIds = []
  for (let i = 0; i < GAS_SAMPLES; i++) {
    const id = randomUUID()
    const hash = sha256Hex('pdf-' + id)
    const r = await (await contract.issueCredential(id, hash, walletFor(i))).wait()
    issueGas.push(Number(r.gasUsed))
    tokenIds.push(i + 1)
    rows.push({ op: 'issueCredential', index: i + 1, certificateId_len: id.length, hash_len: hash.length, reason_len: '', gasUsed: Number(r.gasUsed) })
  }
  for (let i = 0; i < GAS_SAMPLES; i++) {
    const r = await (await contract.revokeCredential(tokenIds[i], REASON)).wait()
    revokeGas.push(Number(r.gasUsed))
    rows.push({ op: 'revokeCredential', index: i + 1, certificateId_len: '', hash_len: '', reason_len: REASON.length, gasUsed: Number(r.gasUsed) })
  }
  // Sensitivity: revocation gas depends on the length of the reason string.
  const sens = []
  for (const len of [0, 10, 20, 38, 60, 100]) {
    const id = randomUUID()
    await (await contract.issueCredential(id, sha256Hex('s' + id), walletFor(900 + len))).wait()
    const tok = Number(await contract.totalIssued())
    const r = await (await contract.revokeCredential(tok, 'x'.repeat(len))).wait()
    sens.push({ reason_len: len, gasUsed: Number(r.gasUsed) })
  }
  const w = csvWriter(path.join(OUT, 'gas_raw.csv'), ['op', 'index', 'certificateId_len', 'hash_len', 'reason_len', 'gasUsed'])
  rows.forEach((r) => w.row(r))
  await w.close()
  const out = {
    deployment: { samples: deployGas, ...summarize(deployGas) },
    issueCredential: { argumentShape: 'certificateId = 36-char UUID, certificateHash = 64-char SHA-256 hex, studentWallet = address', ...summarize(issueGas) },
    revokeCredential: { reason: REASON, reasonLength: REASON.length, ...summarize(revokeGas) },
    revokeGasByReasonLength: sens,
    previouslyRecorded: { deployment: 1106265, issueCredential: 241948, revokeCredential: 73640, approxFeePOL: 0.0068, note: 'user-supplied historical Amoy values; not independently verifiable from the repository' },
  }
  return out
}

async function batchSection(issuer) {
  const results = []
  const raw = csvWriter(path.join(OUT, 'batch_raw.csv'), ['batch_size', 'rep', 'index', 'send_ms', 'confirm_ms', 'total_ms', 'gasUsed', 'ok', 'error'])
  for (const size of SIZES) {
    for (let rep = REP_START; rep < REP_START + REPS; rep++) {
      const { contract } = await deploy(issuer) // fresh contract per run so every run starts from the same state
      let ok = 0, fail = 0, gasTotal = 0
      const perTx = []
      const t0 = performance.now()
      for (let i = 0; i < size; i++) {
        const id = randomUUID()
        const hash = sha256Hex(`batch-${size}-${rep}-${i}-${id}`)
        const s0 = performance.now()
        try {
          const tx = await contract.issueCredential(id, hash, walletFor(i))
          const s1 = performance.now()
          const r = await tx.wait()
          const s2 = performance.now()
          ok++; gasTotal += Number(r.gasUsed); perTx.push(s2 - s0)
          raw.row({ batch_size: size, rep, index: i + 1, send_ms: (s1 - s0).toFixed(3), confirm_ms: (s2 - s1).toFixed(3), total_ms: (s2 - s0).toFixed(3), gasUsed: Number(r.gasUsed), ok: true, error: '' })
        } catch (e) {
          fail++
          raw.row({ batch_size: size, rep, index: i + 1, send_ms: '', confirm_ms: '', total_ms: (performance.now() - s0).toFixed(3), gasUsed: '', ok: false, error: errText(e) })
        }
      }
      const totalMs = performance.now() - t0
      const onChain = Number(await contract.totalIssued())
      const rec = {
        batch_size: size, rep, total_ms: totalMs, avg_ms_per_certificate: totalMs / size,
        successful: ok, failed: fail, failure_pct: (fail / size) * 100,
        total_gas: gasTotal, avg_gas_per_certificate: ok ? gasTotal / ok : null,
        onchain_totalIssued: onChain, per_tx_ms: summarize(perTx),
        throughput_certs_per_s: ok / (totalMs / 1000),
      }
      results.push(rec)
      console.log(`[batch] size=${size} rep=${rep} ok=${ok} fail=${fail} total=${(totalMs / 1000).toFixed(2)}s avg=${rec.avg_ms_per_certificate.toFixed(2)}ms gas=${gasTotal} onchain=${onChain}`)
    }
  }
  await raw.close()
  const bySize = SIZES.map((size) => {
    const rs = results.filter((r) => r.batch_size === size)
    return {
      batch_size: size, reps: rs.length,
      total_ms_per_rep: rs.map((r) => r.total_ms),
      total_ms_median: summarize(rs.map((r) => r.total_ms)).median,
      avg_ms_per_certificate_median: summarize(rs.map((r) => r.avg_ms_per_certificate)).median,
      successful_total: rs.reduce((s, r) => s + r.successful, 0),
      failed_total: rs.reduce((s, r) => s + r.failed, 0),
      failure_pct: (rs.reduce((s, r) => s + r.failed, 0) / (size * rs.length)) * 100,
      total_gas_per_rep: rs.map((r) => r.total_gas),
      avg_gas_per_certificate: rs.reduce((s, r) => s + r.total_gas, 0) / rs.reduce((s, r) => s + r.successful, 0),
      throughput_certs_per_s_median: summarize(rs.map((r) => r.throughput_certs_per_s)).median,
    }
  })
  return { runs: results, bySize }
}

async function securitySection(issuer, attacker) {
  const tests = []
  const add = (id, name, expected, actual, pass, evidence) => tests.push({ id, name, expected, actual, result: pass ? 'PASS' : 'FAIL', evidence })
  const { contract, address } = await deploy(issuer)
  const asAttacker = contract.connect(attacker)
  const attackerAddr = await attacker.getAddress()
  const id1 = randomUUID(), pdf = Buffer.from('%PDF-1.4 original certificate bytes ' + id1)
  const h1 = sha256Hex(pdf)
  await (await contract.issueCredential(id1, h1, walletFor(1))).wait()

  async function expectRevert(fn, needle) {
    try { const r = await fn(); if (r?.wait) await r.wait(); return { reverted: false, msg: 'transaction succeeded' } }
    catch (e) { const m = errText(e); return { reverted: m.includes(needle), msg: m } }
  }
  let r
  r = await expectRevert(() => asAttacker.issueCredential(randomUUID(), sha256Hex('x'), walletFor(2)), 'not the authorized issuer')
  add('C1', 'Unauthorized issuance (non-issuer account)', 'revert: caller is not the authorized issuer', r.msg, r.reverted, r.msg)
  r = await expectRevert(() => asAttacker.revokeCredential(1, 'attack'), 'not the authorized issuer')
  add('C2', 'Unauthorized revocation (non-issuer account)', 'revert: caller is not the authorized issuer', r.msg, r.reverted, r.msg)
  r = await expectRevert(() => contract.issueCredential(id1, sha256Hex('other'), walletFor(3)), 'already minted')
  add('C3', 'Duplicate issuance (same certificateId)', 'revert: certificate already minted', r.msg, r.reverted, r.msg)
  r = await expectRevert(() => asAttacker.setIssuer(attackerAddr), 'not the authorized issuer')
  add('C4', 'Issuer takeover via setIssuer by non-issuer', 'revert: caller is not the authorized issuer', r.msg, r.reverted, r.msg)
  r = await expectRevert(() => contract.issueCredential(randomUUID(), sha256Hex('z'), ethers.ZeroAddress), 'invalid student wallet')
  add('C5', 'Issue to zero address', 'revert: invalid student wallet', r.msg, r.reverted, r.msg)
  r = await expectRevert(() => contract.issueCredential('', sha256Hex('z'), walletFor(4)), 'certificateId required')
  add('C6', 'Issue with empty certificateId', 'revert: certificateId required', r.msg, r.reverted, r.msg)
  r = await expectRevert(() => contract.issueCredential(randomUUID(), '', walletFor(4)), 'certificateHash required')
  add('C7', 'Issue with empty certificateHash', 'revert: certificateHash required', r.msg, r.reverted, r.msg)
  r = await expectRevert(() => contract.revokeCredential(9999, 'nope'), 'does not exist')
  add('C8', 'Revoke non-existent token', 'revert: credential does not exist', r.msg, r.reverted, r.msg)
  r = await expectRevert(() => contract.getCredential(9999), 'does not exist')
  add('C9', 'Read non-existent token (invalid reference)', 'revert: credential does not exist', r.msg, r.reverted, r.msg)

  // Tamper detection at contract level: hash stored on-chain vs hash of a modified PDF
  const tampered = Buffer.from(pdf); tampered[tampered.length - 1] ^= 0x01
  const onchain = (await contract.getCredential(1)).certificateHash
  const okOriginal = onchain === sha256Hex(pdf)
  const detected = onchain !== sha256Hex(tampered)
  add('C10', 'Modified PDF after issuance (1-bit change) no longer matches on-chain hash', 'on-chain hash == hash(original) and != hash(modified)', `original match=${okOriginal}; modified differs=${detected}`, okOriginal && detected, `onchain=${onchain.slice(0, 16)}… modified=${sha256Hex(tampered).slice(0, 16)}…`)

  // Revocation and its consequences
  await (await contract.revokeCredential(1, REASON)).wait()
  const valid = await contract.isValid(1)
  const cred = await contract.getCredential(1)
  add('C11', 'Revoked credential reports invalid', 'isValid(1)=false, revoked=true, reason stored', `isValid=${valid}; revoked=${cred.revoked}; reason="${cred.revokeReason}"`, valid === false && cred.revoked === true && cred.revokeReason === REASON, 'on-chain read after revocation')
  r = await expectRevert(() => contract.revokeCredential(1, 'again'), 'already revoked')
  add('C12', 'Double revocation', 'revert: credential already revoked', r.msg, r.reverted, r.msg)
  r = await expectRevert(() => contract.issueCredential(id1, sha256Hex('reissue'), walletFor(5)), 'already minted')
  add('C13', 'Re-issue of a revoked certificate id', 'revert: certificate already minted', r.msg, r.reverted, r.msg)

  // Soulbound: no transfer / approval function exists
  const names = artifact.abi.filter((x) => x.type === 'function').map((x) => x.name)
  const forbidden = names.filter((n) => /transfer|approve/i.test(n))
  add('C14', 'No transfer/approval functions in ABI (soulbound)', 'no function matching transfer*/approve*', `functions: ${names.join(', ')}`, forbidden.length === 0, 'ABI inspection')
  // Tampered hash handed to the chain still cannot overwrite the stored one
  const id2 = randomUUID()
  await (await contract.issueCredential(id2, sha256Hex('genuine'), walletFor(6))).wait()
  r = await expectRevert(() => contract.issueCredential(id2, sha256Hex('forged-hash'), walletFor(6)), 'already minted')
  const stored = (await contract.getCredential(2)).certificateHash
  add('C15', 'Attempt to overwrite stored certificate hash via re-issue', 'revert and stored hash unchanged', `${r.msg}; stored==genuine: ${stored === sha256Hex('genuine')}`, r.reverted && stored === sha256Hex('genuine'), 'on-chain read after attempt')
  return { contractAddress: address, tests }
}

async function main() {
  await assertLocalChain(config.rpcUrl)
  const issuer = await provider.getSigner(0)
  const attacker = await provider.getSigner(1)
  const net = await provider.send('web3_clientVersion', [])
  const env = environment({
    runId: RUN_ID, executionHost: `${os.platform()} ${os.release()} ${os.arch()} (${os.cpus().length} vCPU, ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB) — see report: this may be the Cowork Linux VM, not native macOS`,
    rpc: 'local Hardhat node (chain 31337), automine', nodeClient: net, solc: '0.8.20 optimizer runs=200 evm=paris (from existing compiled artifact)',
    parameters: { sizes: SIZES, reps: REPS, gasSamples: GAS_SAMPLES },
  })
  writeJson(path.join(OUT, 'environment.json'), env)
  const summary = { runId: RUN_ID, scope: 'CONTRACT-LEVEL ONLY — not the production application workflow' }
  if (ONLY.has('gas')) { summary.gas = await gasSection(issuer); console.log('[gas]', JSON.stringify({ deploy: summary.gas.deployment.median, issue: summary.gas.issueCredential.median, revoke: summary.gas.revokeCredential.median })) }
  if (ONLY.has('security')) { summary.security = await securitySection(issuer, attacker); const p = summary.security.tests.filter((t) => t.result === 'PASS').length; console.log(`[security] ${p}/${summary.security.tests.length} PASS`) }
  if (ONLY.has('batch')) summary.batch = await batchSection(issuer)
  writeJson(path.join(OUT, 'summary.json'), summary)
  console.log('[done]', OUT)
}

main().catch((e) => { console.error('[contract-bench] failed:', e); process.exitCode = 1 })
