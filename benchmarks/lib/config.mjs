import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { assertLocalUrl } from './guards.mjs'

// All benchmark settings come from BENCH_* variables with local defaults. No .env file is read.
export const BENCH_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const REPO_DIR = path.resolve(BENCH_DIR, '..')

export const config = {
  apiBase: process.env.BENCH_API_BASE ?? 'http://127.0.0.1:8081',
  rpcUrl: process.env.BENCH_RPC_URL ?? 'http://127.0.0.1:8545',
  resultsDir: process.env.BENCH_RESULTS_DIR ?? path.join(BENCH_DIR, 'results'),
  fixturesDir: process.env.BENCH_FIXTURES_DIR ?? path.join(BENCH_DIR, 'fixtures'),
  localChainFile: path.join(BENCH_DIR, '.local-chain.json'),
}

assertLocalUrl('BENCH_API_BASE', config.apiBase)
assertLocalUrl('BENCH_RPC_URL', config.rpcUrl)

export function readLocalChain() {
  if (!existsSync(config.localChainFile)) {
    throw new Error('benchmarks/.local-chain.json not found. Run blockchain/scripts/bench/deploy-local.js first.')
  }
  return JSON.parse(readFileSync(config.localChainFile, 'utf8'))
}

export function readContractAbi() {
  const artifact = path.join(REPO_DIR, 'blockchain', 'artifacts', 'contracts', 'SkillChainCredential.sol', 'SkillChainCredential.json')
  return JSON.parse(readFileSync(artifact, 'utf8')).abi
}

/** Parses --key=value flags into an object. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {}
  for (const arg of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (m) out[m[1]] = m[2] ?? 'true'
  }
  return out
}
