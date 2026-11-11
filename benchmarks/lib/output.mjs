import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs'
import { execSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { REPO_DIR } from './config.mjs'

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
  return dir
}

export function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

function csvCell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Streaming CSV writer so long concurrency runs never hold every row in memory. */
export function csvWriter(file, columns) {
  const stream = createWriteStream(file)
  stream.write(columns.join(',') + '\n')
  return {
    row(obj) {
      stream.write(columns.map((c) => csvCell(obj[c])).join(',') + '\n')
    },
    close() {
      return new Promise((resolve) => stream.end(resolve))
    },
  }
}

function quiet(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_DIR, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

export function environment(extra = {}) {
  return {
    capturedAtUtc: new Date().toISOString(),
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpuModel: os.cpus()[0]?.model ?? '',
    logicalCpus: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    gitCommit: quiet('git rev-parse HEAD'),
    gitWorkingTreeDirty: quiet('git status --porcelain') !== '',
    ...extra,
  }
}

export function runId(label) {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-')
  return label ? `${ts}-${label}` : ts
}

export { path }
