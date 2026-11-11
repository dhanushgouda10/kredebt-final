// Prepares data for the verification benchmark on the LOCAL stack only. Nothing here is timed.
//
// What it does, through the real backend endpoints:
//   1. Admin login with the real nonce + EIP-191 signature flow, signed by the local Hardhat
//      node's built-in account #0 (the node signs; no private key exists in this script).
//   2. Creates N students            (POST /api/admin/students)
//   3. Creates + uploads N certificates using the 1 MB fixture
//                                     (POST /api/admin/certificates, POST .../{id}/upload)
//   4. Issues each on the LOCAL chain (issueCredential, standing in for MetaMask) and records it
//                                     (POST .../{id}/blockchain/issue)
//   5. Revokes R of them on the LOCAL chain and records it
//                                     (POST .../{id}/blockchain/revoke)
// Writes benchmarks/results/seed-<tag>.json listing the MINTED and REVOKED certificate numbers.
//
// Usage: node verification/seed.mjs [--students=100] [--revoke=20] [--tag=<label>]
// Guards: refuses to run unless the backend and RPC are on localhost and the chain ID is 31337.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ethers } from 'ethers'
import { config, parseArgs, readLocalChain, readContractAbi } from '../lib/config.mjs'
import { assertLocalChain } from '../lib/guards.mjs'
import { api } from '../lib/api.mjs'
import { ensureDir, writeJson } from '../lib/output.mjs'

const args = parseArgs()
const STUDENTS = Number(args.students ?? 100)
const REVOKE = Number(args.revoke ?? 20)
const TAG = (args.tag ?? Date.now().toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, '')
const FIXTURE = path.join(config.fixturesDir, 'fixture-1MB.pdf')

async function main() {
  await assertLocalChain(config.rpcUrl)
  const chain = readLocalChain()
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, { staticNetwork: true })
  if ((await provider.getCode(chain.contractAddress)) === '0x') {
    throw new Error('No contract at the address in .local-chain.json. Was the Hardhat node restarted? Re-run deploy-local.js.')
  }
  const signer = await provider.getSigner(0)
  const adminAddress = (await signer.getAddress()).toLowerCase()
  if (adminAddress !== chain.issuer) throw new Error('Hardhat account #0 is not the local contract issuer.')
  const contract = new ethers.Contract(chain.contractAddress, readContractAbi(), signer)
  const pdf = readFileSync(FIXTURE)

  // 1. Admin login (real flow)
  const { nonce } = await api('GET', `/api/auth/admin/nonce?address=${adminAddress}`)
  const signature = await signer.signMessage(nonce)
  const { token } = await api('POST', '/api/auth/admin/wallet-login', { json: { walletAddress: adminAddress, signature } })
  console.log('[seed] admin login ok')

  const minted = []
  for (let i = 1; i <= STUDENTS; i++) {
    const n = String(i).padStart(4, '0')
    // 2. Student (local fake data; EMAIL_API_KEY is unset by the start script, so no email is sent)
    const student = await api('POST', '/api/admin/students', {
      token,
      json: {
        fullName: `Bench Student ${n}`,
        usn: `BENCH${TAG}${n}`,
        email: `bench.${TAG.toLowerCase()}.${n}@mvjce.edu.in`,
        phone: `90000${n.padStart(5, '0')}`,
        department: 'CSE',
        password: `local-bench-${TAG}-${n}`,
      },
    })

    // 3. Certificate metadata + PDF upload (stamping + hashing + mock storage)
    const cert = await api('POST', '/api/admin/certificates', {
      token,
      json: { studentId: student.id, degreeName: 'Bachelor of Engineering (CSE)', yearOfCompletion: 2026 },
    })
    const form = new FormData()
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'bench-certificate.pdf')
    const uploaded = await api('POST', `/api/admin/certificates/${cert.id}/upload`, { token, form })

    // 4. Local on-chain issue, then the real backend record call
    const tx = await contract.issueCredential(cert.id, uploaded.fileHash, uploaded.studentWalletAddress)
    const receipt = await tx.wait()
    const event = receipt.logs.map((l) => { try { return contract.interface.parseLog(l) } catch { return null } })
      .find((e) => e?.name === 'CredentialIssued')
    const tokenId = Number(event.args.tokenId)
    await api('POST', `/api/admin/certificates/${cert.id}/blockchain/issue`, {
      token,
      json: {
        studentWalletAddress: uploaded.studentWalletAddress,
        certificateHash: uploaded.fileHash,
        tokenId,
        contractAddress: chain.contractAddress,
        transactionHash: receipt.hash,
      },
    })
    minted.push({ id: cert.id, certificateNumber: cert.certificateNumber, tokenId })
    if (i % 10 === 0) console.log(`[seed] ${i}/${STUDENTS} issued`)
  }

  // 5. Revoke the last R on the local chain + record
  const revoked = []
  for (const c of minted.slice(-REVOKE)) {
    const reason = 'Benchmark revocation (local test data)'
    const receipt = await (await contract.revokeCredential(c.tokenId, reason)).wait()
    await api('POST', `/api/admin/certificates/${c.id}/blockchain/revoke`, {
      token,
      json: { tokenId: c.tokenId, transactionHash: receipt.hash, reason },
    })
    revoked.push(c)
  }
  const stillMinted = minted.slice(0, minted.length - revoked.length)

  ensureDir(config.resultsDir)
  const manifest = path.join(config.resultsDir, `seed-${TAG}.json`)
  writeJson(manifest, {
    tag: TAG,
    createdAtUtc: new Date().toISOString(),
    contractAddress: chain.contractAddress,
    chainId: chain.chainId,
    fixture: 'fixture-1MB.pdf',
    minted: stillMinted,
    revoked,
  })
  console.log(`[seed] done: ${stillMinted.length} MINTED, ${revoked.length} REVOKED -> ${manifest}`)
}

main().catch((e) => {
  console.error('[seed] failed:', e.message)
  process.exitCode = 1
})
