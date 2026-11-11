// Issuance + revocation latency through the REAL backend endpoints, on the LOCAL stack only.
//
// Per iteration, each phase is timed separately with performance.now():
//   C   POST /api/admin/certificates                 backend metadata + DB (createMetadata + audit log)
//   U   POST /api/admin/certificates/{id}/upload     upload request: network transfer + validation +
//                                                    QR stamping (A) + SHA-256 (B) + storage upload (D, mock
//                                                    storage here) + DB save. A and B are NOT separable over HTTP
//                                                    without changing the app; they are measured in-process by the
//                                                    stamping/hashing benchmark (Part 3).
//   E1  signer.sendTransaction (issueCredential)     "sign + submit". Here the Hardhat node's unlocked test account
//                                                    signs. THIS IS NOT MetaMask: no wallet popup, no human click.
//   E2  tx.wait()                                    confirmation. Hardhat automine = instant; NOT Polygon block time.
//   F   POST .../blockchain/issue                    backend receipt verification (eth_getTransactionReceipt) + DB
//   G   end-to-end (C..F)                            wall clock for the whole sequence (excludes human think time)
// Revocation: E1r, E2r, Fr (POST .../blockchain/revoke), Gr.
//
// Student creation (setup) is not timed. Iteration 1..warmup are recorded as phase=warmup and excluded.
// Usage: node issuance/run.mjs [--n=35] [--warmup=3] [--sizes=0_1MB,1MB,5MB] [--label=x]

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ethers } from 'ethers'
import { config, parseArgs, readLocalChain, readContractAbi } from '../lib/config.mjs'
import { assertLocalChain } from '../lib/guards.mjs'
import { api } from '../lib/api.mjs'
import { summarize } from '../lib/stats.mjs'
import { ensureDir, writeJson, csvWriter, environment, runId } from '../lib/output.mjs'

const args = parseArgs()
const N = Number(args.n ?? 35)
const WARMUP = Number(args.warmup ?? 3)
const SIZES = (args.sizes ?? '0_1MB,1MB,5MB').split(',')
const TAG = ('ISS' + Date.now().toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, '')
const RUN_ID = runId(args.label ?? 'issuance')
const OUT = ensureDir(path.join(config.resultsDir, RUN_ID, 'issuance'))
const t = () => performance.now()

async function main() {
  await assertLocalChain(config.rpcUrl)
  const chain = readLocalChain()
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, { staticNetwork: true, pollingInterval: 10 })
  if ((await provider.getCode(chain.contractAddress)) === '0x') throw new Error('No contract at the address in .local-chain.json (node restarted?). Re-run deploy-local.js.')
  const signer = await provider.getSigner(0)
  const adminAddress = (await signer.getAddress()).toLowerCase()
  if (adminAddress !== chain.issuer) throw new Error('Hardhat account #0 is not the local contract issuer.')
  const contract = new ethers.Contract(chain.contractAddress, readContractAbi(), signer)

  const { nonce } = await api('GET', `/api/auth/admin/nonce?address=${adminAddress}`)
  const { token } = await api('POST', '/api/auth/admin/wallet-login', { json: { walletAddress: adminAddress, signature: await signer.signMessage(nonce) } })

  const cols = ['run_id', 'size', 'iteration', 'phase', 'ok', 'error', 'C_metadata_ms', 'U_upload_ms', 'E1_sign_submit_ms', 'E2_confirm_ms', 'F_receipt_verify_ms', 'G_issue_total_ms',
    'R_E1_sign_submit_ms', 'R_E2_confirm_ms', 'R_F_receipt_verify_ms', 'R_G_revoke_total_ms', 'issue_gas', 'revoke_gas', 'certificate_number']
  const csv = csvWriter(path.join(OUT, 'issuance_revocation_raw.csv'), cols)
  const summary = { runId: RUN_ID, scope: 'Application workflow on the local stack; blockchain signing is a Hardhat unlocked account, NOT MetaMask', bySize: {} }

  for (const size of SIZES) {
    const pdf = readFileSync(path.join(config.fixturesDir, `fixture-${size}.pdf`))
    const rows = []
    let seq = 0
    for (let i = 1; i <= N + WARMUP; i++) {
      const phase = i <= WARMUP ? 'warmup' : 'measured'
      const row = { run_id: RUN_ID, size, iteration: i, phase, ok: false, error: '' }
      try {
        seq++
        const n = `${size.replace(/\W/g, '')}${String(seq).padStart(3, '0')}`
        const student = await api('POST', '/api/admin/students', { token, json: {
          fullName: `Iss Student ${n}`, usn: `${TAG}${n}`, email: `iss.${TAG.toLowerCase()}.${n.toLowerCase()}@mvjce.edu.in`,
          phone: `91000${String(seq).padStart(5, '0')}`, department: 'CSE', password: `local-bench-${TAG}-${n}` } })

        const g0 = t()
        let s = t()
        const cert = await api('POST', '/api/admin/certificates', { token, json: { studentId: student.id, degreeName: 'Bachelor of Engineering (CSE)', yearOfCompletion: 2026 } })
        row.C_metadata_ms = t() - s
        row.certificate_number = cert.certificateNumber

        const form = new FormData()
        form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'bench-certificate.pdf')
        s = t()
        const uploaded = await api('POST', `/api/admin/certificates/${cert.id}/upload`, { token, form })
        row.U_upload_ms = t() - s

        s = t()
        const tx = await contract.issueCredential(cert.id, uploaded.fileHash, uploaded.studentWalletAddress)
        row.E1_sign_submit_ms = t() - s
        s = t()
        const receipt = await tx.wait()
        row.E2_confirm_ms = t() - s
        row.issue_gas = Number(receipt.gasUsed)
        const ev = receipt.logs.map((l) => { try { return contract.interface.parseLog(l) } catch { return null } }).find((e) => e?.name === 'CredentialIssued')
        const tokenId = Number(ev.args.tokenId)

        s = t()
        await api('POST', `/api/admin/certificates/${cert.id}/blockchain/issue`, { token, json: {
          studentWalletAddress: uploaded.studentWalletAddress, certificateHash: uploaded.fileHash, tokenId, contractAddress: chain.contractAddress, transactionHash: receipt.hash } })
        row.F_receipt_verify_ms = t() - s
        row.G_issue_total_ms = t() - g0

        // Revocation
        const reason = 'Benchmark revocation (local test data)'
        const r0 = t()
        s = t()
        const rtx = await contract.revokeCredential(tokenId, reason)
        row.R_E1_sign_submit_ms = t() - s
        s = t()
        const rrec = await rtx.wait()
        row.R_E2_confirm_ms = t() - s
        row.revoke_gas = Number(rrec.gasUsed)
        s = t()
        await api('POST', `/api/admin/certificates/${cert.id}/blockchain/revoke`, { token, json: { tokenId, transactionHash: rrec.hash, reason } })
        row.R_F_receipt_verify_ms = t() - s
        row.R_G_revoke_total_ms = t() - r0
        row.ok = true
      } catch (e) {
        row.error = String(e.message).slice(0, 200)
      }
      for (const k of Object.keys(row)) if (typeof row[k] === 'number' && !Number.isInteger(row[k])) row[k] = row[k].toFixed(3)
      csv.row(row)
      rows.push(row)
      if (i % 10 === 0) console.log(`[issuance] ${size}: ${i}/${N + WARMUP}`)
    }
    const m = rows.filter((r) => r.phase === 'measured')
    const good = m.filter((r) => r.ok)
    const stat = (k) => summarize(good.map((r) => Number(r[k])))
    summary.bySize[size] = {
      fixtureBytes: pdf.length, measuredAttempts: m.length, successful: good.length, failed: m.length - good.length,
      C_metadata_ms: stat('C_metadata_ms'), U_upload_ms: stat('U_upload_ms'), E1_sign_submit_ms: stat('E1_sign_submit_ms'), E2_confirm_ms: stat('E2_confirm_ms'),
      F_receipt_verify_ms: stat('F_receipt_verify_ms'), G_issue_total_ms: stat('G_issue_total_ms'),
      R_E1_sign_submit_ms: stat('R_E1_sign_submit_ms'), R_E2_confirm_ms: stat('R_E2_confirm_ms'), R_F_receipt_verify_ms: stat('R_F_receipt_verify_ms'), R_G_revoke_total_ms: stat('R_G_revoke_total_ms'),
      issue_gas: stat('issue_gas'), revoke_gas: stat('revoke_gas'),
    }
    console.log(`[issuance] ${size}: ok=${good.length}/${m.length} median issue total=${summary.bySize[size].G_issue_total_ms.median?.toFixed(1)} ms`)
  }
  await csv.close()
  writeJson(path.join(OUT, 'summary.json'), summary)
  writeJson(path.join(OUT, 'environment.json'), environment({ runId: RUN_ID, parameters: { N, WARMUP, SIZES }, rpc: 'local Hardhat node (chain 31337)', apiBase: 'local backend (127.0.0.1)',
    notMeasured: 'Real MetaMask popup/signing/confirmation, Polygon Amoy block time, Supabase network latency' }))
  console.log('[issuance] done ->', OUT)
}

main().catch((e) => { console.error('[issuance] failed:', e.message); process.exitCode = 1 })
