// HTTP-level adversarial / security tests against the REAL, UNMODIFIED backend, local stack only.
// Expected results are derived from reading the application code (SecurityConfig, JwtAuthFilter,
// CertificateService, PublicVerificationService, BlockchainVerificationService) BEFORE running.
// Nothing here changes application logic. Every test is actually executed; PASS/FAIL is computed
// from the observed HTTP response, never assumed.
//
// Usage: node security/run.mjs [--label=x]

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ethers } from 'ethers'
import { config, parseArgs, readLocalChain, readContractAbi } from '../lib/config.mjs'
import { assertLocalChain } from '../lib/guards.mjs'
import { ensureDir, writeJson, environment, runId } from '../lib/output.mjs'

const args = parseArgs()
const RUN_ID = runId(args.label ?? 'security')
const OUT = ensureDir(path.join(config.resultsDir, RUN_ID, 'security'))
const TAG = ('SEC' + Date.now().toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, '')
const results = []

// Raw HTTP helper that never throws on non-2xx (we want the status).
async function http(method, p, { token, json, form } = {}) {
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`
  let body
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json) } else if (form) body = form
  try {
    const res = await fetch(config.apiBase + p, { method, headers, body })
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, data, text: text.slice(0, 200) }
  } catch (e) { return { status: 0, data: null, text: String(e.message) } }
}
const DENIED = (s) => s === 401 || s === 403

function record(id, name, expected, r, pass, note = '') {
  const actual = `HTTP ${r.status}${r.data?.result ? ' result=' + r.data.result : ''}${r.data?.message ? ' msg="' + String(r.data.message).slice(0, 110) + '"' : ''}`
  results.push({ id, name, expected, actual, result: pass ? 'PASS' : 'FAIL', evidence: r.text.replace(/\s+/g, ' ').slice(0, 160), note })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id} ${name}: ${actual}`)
}

async function main() {
  await assertLocalChain(config.rpcUrl)
  const chain = readLocalChain()
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, { staticNetwork: true, pollingInterval: 10 })
  const signer = await provider.getSigner(0)
  const attacker = await provider.getSigner(1)
  const adminAddress = (await signer.getAddress()).toLowerCase()
  const contract = new ethers.Contract(chain.contractAddress, readContractAbi(), signer)
  const pdf = readFileSync(path.join(config.fixturesDir, 'fixture-1MB.pdf'))

  const nonce = (await http('GET', `/api/auth/admin/nonce?address=${adminAddress}`)).data.nonce
  const adminToken = (await http('POST', '/api/auth/admin/wallet-login', { json: { walletAddress: adminAddress, signature: await signer.signMessage(nonce) } })).data.token

  // ---- setup: a student with a student JWT, and helper to mint a certificate through the real flow
  let k = 0
  async function newStudent() {
    k++
    const n = String(k).padStart(3, '0')
    const email = `sec.${TAG.toLowerCase()}.${n}@mvjce.edu.in`, password = `local-bench-${TAG}-${n}`
    const s = await http('POST', '/api/admin/students', { token: adminToken, json: { fullName: `Sec Student ${n}`, usn: `${TAG}${n}`, email, phone: `92000${String(k).padStart(5, '0')}`, department: 'CSE', password } })
    return { id: s.data.id, email, password }
  }
  async function uploadedCert(student) {
    const c = (await http('POST', '/api/admin/certificates', { token: adminToken, json: { studentId: student.id, degreeName: 'Bachelor of Engineering (CSE)', yearOfCompletion: 2026 } })).data
    const form = new FormData(); form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'sec.pdf')
    const u = (await http('POST', `/api/admin/certificates/${c.id}/upload`, { token: adminToken, form })).data
    return { id: c.id, number: c.certificateNumber, hash: u.fileHash, wallet: u.studentWalletAddress }
  }
  async function mint(cert) {
    const rec = await (await contract.issueCredential(cert.id, cert.hash, cert.wallet)).wait()
    const ev = rec.logs.map((l) => { try { return contract.interface.parseLog(l) } catch { return null } }).find((e) => e?.name === 'CredentialIssued')
    cert.tokenId = Number(ev.args.tokenId); cert.txHash = rec.hash
    const r = await http('POST', `/api/admin/certificates/${cert.id}/blockchain/issue`, { token: adminToken, json: { studentWalletAddress: cert.wallet, certificateHash: cert.hash, tokenId: cert.tokenId, contractAddress: chain.contractAddress, transactionHash: rec.hash } })
    if (r.status !== 200) throw new Error('setup mint failed: ' + r.text)
    return cert
  }

  const stu = await newStudent()
  const studentToken = (await http('POST', '/api/auth/login', { json: { email: stu.email, password: stu.password } })).data?.token
  const A = await mint(await uploadedCert(stu))

  // ---- Modified PDF after issuance
  const dl = await fetch(`${config.apiBase}/api/certificates/${A.id}/download`, { headers: { authorization: `Bearer ${adminToken}` } })
  const stamped = Buffer.from(await dl.arrayBuffer())
  const postPdf = (num, buf) => { const f = new FormData(); f.append('file', new Blob([buf], { type: 'application/pdf' }), 'x.pdf'); return http('POST', `/api/verify/${num}/pdf`, { form: f }) }
  let r = await postPdf(A.number, stamped)
  record('S0', 'Positive control: unmodified issued PDF', 'HTTP 200 result=AUTHENTIC', r, r.status === 200 && r.data?.result === 'AUTHENTIC')
  const tampered = Buffer.from(stamped); tampered[tampered.length - 20] ^= 0x01
  r = await postPdf(A.number, tampered)
  record('S1', 'Modified PDF after issuance (1 byte flipped)', 'HTTP 200 result=TAMPERED', r, r.status === 200 && r.data?.result === 'TAMPERED')
  r = await postPdf(A.number, Buffer.from('not a pdf, just text'))
  record('S1b', 'Non-PDF bytes uploaded to PDF verification', 'HTTP 400 (signature check)', r, r.status === 400)

  // ---- Incorrect number / invalid input
  r = await http('GET', '/api/verify/SKC-0000-DOESNOTEXIST')
  record('S2', 'Incorrect certificate number', 'HTTP 200 result=INVALID', r, r.status === 200 && r.data?.result === 'INVALID')
  const bad = [["S3a", "SQL-injection style input", encodeURIComponent("' OR '1'='1")], ["S3b", 'Path-traversal style input', encodeURIComponent('../../etc/passwd')], ["S3c", 'Whitespace-only input', '%20'], ["S3d", '2,000-character input', 'A'.repeat(2000)], ["S3e", 'Malformed QR payload (full URL instead of number)', encodeURIComponent('http://localhost:5173/verify/' + A.number)]]
  for (const [id, name, v] of bad) {
    r = await http('GET', `/api/verify/${v}`)
    record(id, `Invalid verification input: ${name}`, 'No 5xx and never VERIFIED (INVALID or 4xx)', r, r.status < 500 && r.status !== 0 && r.data?.result !== 'VERIFIED')
  }

  // ---- Auth: unauthorized issuance / revocation, invalid JWT
  const issueBody = { studentWalletAddress: A.wallet, certificateHash: A.hash, tokenId: 1, contractAddress: chain.contractAddress, transactionHash: A.txHash }
  r = await http('POST', '/api/admin/certificates', { json: { studentId: stu.id, degreeName: 'X', yearOfCompletion: 2026 } })
  record('S4a', 'Unauthorized issuance: create certificate, no token', 'HTTP 401 or 403', r, DENIED(r.status))
  r = await http('POST', '/api/admin/certificates', { token: studentToken, json: { studentId: stu.id, degreeName: 'X', yearOfCompletion: 2026 } })
  record('S4b', 'Unauthorized issuance: create certificate with STUDENT token', 'HTTP 403', r, r.status === 403)
  r = await http('POST', `/api/admin/certificates/${A.id}/blockchain/issue`, { json: issueBody })
  record('S4c', 'Unauthorized issuance: blockchain/issue, no token', 'HTTP 401 or 403', r, DENIED(r.status))
  r = await http('POST', `/api/admin/certificates/${A.id}/blockchain/issue`, { token: studentToken, json: issueBody })
  record('S4d', 'Unauthorized issuance: blockchain/issue with STUDENT token', 'HTTP 403', r, r.status === 403)
  const revBody = { tokenId: A.tokenId, transactionHash: A.txHash, reason: 'unauthorised attempt' }
  r = await http('POST', `/api/admin/certificates/${A.id}/blockchain/revoke`, { json: revBody })
  record('S5a', 'Unauthorized revocation: no token', 'HTTP 401 or 403', r, DENIED(r.status))
  r = await http('POST', `/api/admin/certificates/${A.id}/blockchain/revoke`, { token: studentToken, json: revBody })
  record('S5b', 'Unauthorized revocation: STUDENT token', 'HTTP 403', r, r.status === 403)
  r = await http('PATCH', `/api/admin/certificates/${A.id}/status`, { token: studentToken, json: { status: 'REVOKED', reason: 'x' } })
  record('S5c', 'Unauthorized status change (PATCH status) with STUDENT token', 'HTTP 403', r, r.status === 403)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const parts = adminToken.split('.')
  const jwts = [
    ['S6a', 'Invalid JWT: random garbage', 'Bearer-garbage-token'],
    ['S6b', 'Invalid JWT: valid admin token with signature altered', `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}${parts[2].endsWith('AA') ? 'BB' : 'AA'}`],
    ['S6c', 'Invalid JWT: alg=none forged admin token', `${b64({ alg: 'none', typ: 'JWT' })}.${parts[1]}.`],
    ['S6d', 'Invalid JWT: payload swapped to claim another subject, original signature', `${parts[0]}.${b64({ ...JSON.parse(Buffer.from(parts[1], 'base64url')), sub: 'attacker@example.com' })}.${parts[2]}`],
  ]
  for (const [id, name, tok] of jwts) {
    r = await http('GET', '/api/admin/certificates?size=1', { token: tok })
    record(id, name, 'HTTP 401 or 403', r, DENIED(r.status))
  }
  r = await http('GET', '/api/admin/certificates?size=1', { token: adminToken })
  record('S6e', 'Positive control: genuine admin token', 'HTTP 200', r, r.status === 200)

  // ---- Duplicate issuance + tampered hash + bad tx references (each on its own fresh certificate)
  r = await http('POST', `/api/admin/certificates/${A.id}/blockchain/issue`, { token: adminToken, json: issueBody })
  record('S7', 'Duplicate issuance of an already-MINTED certificate (API)', 'HTTP 409', r, r.status === 409)
  let dup = 'unexpected success'
  try { await contract.issueCredential.staticCall(A.id, A.hash, A.wallet); } catch (e) { dup = String(e.reason ?? e.shortMessage ?? e.message).slice(0, 100) }
  results.push({ id: 'S7b', name: 'Duplicate issuance on-chain (same certificateId)', expected: 'contract reverts "certificate already minted"', actual: dup, result: dup.includes('already minted') ? 'PASS' : 'FAIL', evidence: 'eth_call revert reason', note: '' })
  console.log(`[${results.at(-1).result}] S7b ${dup}`)

  const B = await uploadedCert(await newStudent())
  const recB = await (await contract.issueCredential(B.id, B.hash, B.wallet)).wait()
  const evB = recB.logs.map((l) => { try { return contract.interface.parseLog(l) } catch { return null } }).find((e) => e?.name === 'CredentialIssued')
  const Bbody = { studentWalletAddress: B.wallet, certificateHash: B.hash, tokenId: Number(evB.args.tokenId), contractAddress: chain.contractAddress, transactionHash: recB.hash }
  const flipped = (h) => h.slice(0, -1) + (h.endsWith('0') ? '1' : '0')
  r = await http('POST', `/api/admin/certificates/${B.id}/blockchain/issue`, { token: adminToken, json: { ...Bbody, certificateHash: flipped(B.hash) } })
  record('S8', 'Tampered certificate hash in issue request', 'HTTP 409 (hash mismatch)', r, r.status === 409)
  r = await http('POST', `/api/admin/certificates/${B.id}/blockchain/issue`, { token: adminToken, json: { ...Bbody, studentWalletAddress: '0x000000000000000000000000000000000000dEaD' } })
  record('S8b', 'Wrong student wallet in issue request', 'HTTP 409', r, r.status === 409)

  const { transactionHash: _omit, ...noTx } = Bbody
  r = await http('POST', `/api/admin/certificates/${B.id}/blockchain/issue`, { token: adminToken, json: noTx })
  record('S9a', 'Missing blockchain transaction reference (field absent)', 'HTTP 400', r, r.status === 400)
  r = await http('POST', `/api/admin/certificates/${B.id}/blockchain/issue`, { token: adminToken, json: { ...Bbody, transactionHash: '' } })
  record('S9b', 'Blank blockchain transaction reference', 'HTTP 400', r, r.status === 400)
  r = await http('POST', `/api/admin/certificates/${B.id}/blockchain/issue`, { token: adminToken, json: { ...Bbody, transactionHash: '0x' + '00'.repeat(31) + '01' } })
  record('S9c', 'Non-existent transaction hash', 'HTTP 400 (no receipt)', r, r.status === 400)
  r = await http('POST', `/api/admin/certificates/${B.id}/blockchain/issue`, { token: adminToken, json: { ...Bbody, transactionHash: 'not-a-hash' } })
  record('S9d', 'Malformed transaction hash', 'HTTP 4xx (not 2xx, not 5xx)', r, r.status >= 400 && r.status < 500)
  const plain = await (await signer.sendTransaction({ to: await attacker.getAddress(), value: 1n })).wait()
  r = await http('POST', `/api/admin/certificates/${B.id}/blockchain/issue`, { token: adminToken, json: { ...Bbody, transactionHash: plain.hash } })
  record('S9e', 'Real transaction, but not sent to the SkillChain contract', 'HTTP 400', r, r.status === 400)
  const failedTx = await attacker.sendTransaction({ to: chain.contractAddress, data: contract.interface.encodeFunctionData('issueCredential', ['x-' + TAG, 'h', await attacker.getAddress()]), gasLimit: 300000 })
  const failedRec = await failedTx.wait().catch((e) => e.receipt ?? null)
  if (failedRec) {
    r = await http('POST', `/api/admin/certificates/${B.id}/blockchain/issue`, { token: adminToken, json: { ...Bbody, transactionHash: failedRec.hash } })
    record('S9f', 'Reverted (status 0) contract transaction from non-issuer wallet as reference', 'HTTP 400 (did not succeed)', r, r.status === 400)
  }

  // Known simplification documented in BlockchainVerificationService: the receipt is not tied to THIS certificate.
  const C = await uploadedCert(await newStudent())
  r = await http('POST', `/api/admin/certificates/${C.id}/blockchain/issue`, { token: adminToken, json: { studentWalletAddress: C.wallet, certificateHash: C.hash, tokenId: Number(evB.args.tokenId), contractAddress: chain.contractAddress, transactionHash: recB.hash } })
  record('S10', "Replay: another certificate's valid admin issuance receipt reused for a different certificate", 'Strict expectation: rejected (4xx)', r, r.status >= 400 && r.status < 500,
    'Documented limitation in BlockchainVerificationService (token ID and receipt are not matched to the certificate). Reported as-is; application logic not changed.')

  // ---- Revoked certificate end to end
  const D = await mint(await uploadedCert(await newStudent()))
  const rv = await (await contract.revokeCredential(D.tokenId, 'Security test revocation')).wait()
  await http('POST', `/api/admin/certificates/${D.id}/blockchain/revoke`, { token: adminToken, json: { tokenId: D.tokenId, transactionHash: rv.hash, reason: 'Security test revocation' } })
  r = await http('GET', `/api/verify/${D.number}`)
  record('S11', 'Revoked certificate verification', 'HTTP 200 result=REVOKED', r, r.status === 200 && r.data?.result === 'REVOKED')
  r = await http('GET', `/api/verify/${A.number}`)
  record('S11b', 'Positive control: minted, unrevoked certificate', 'HTTP 200 result=VERIFIED', r, r.status === 200 && r.data?.result === 'VERIFIED')

  const passed = results.filter((x) => x.result === 'PASS').length
  writeJson(path.join(OUT, 'security_results.json'), { runId: RUN_ID, total: results.length, passed, failed: results.length - passed, tests: results })
  writeJson(path.join(OUT, 'environment.json'), environment({ runId: RUN_ID, rpc: 'local Hardhat node (chain 31337)' }))
  console.log(`[security] ${passed}/${results.length} PASS -> ${OUT}`)
}

main().catch((e) => { console.error('[security] failed:', e.message); process.exitCode = 1 })
