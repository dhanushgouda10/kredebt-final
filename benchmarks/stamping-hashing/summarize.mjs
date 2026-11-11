// Pools the per-launch raw CSVs written by StampingHashingBenchmarkTest into one summary.
// Usage: node stamping-hashing/summarize.mjs --run=<runId>
// Reads  results/<runId>/stamping-hashing/launch-*/stamping_hashing_raw.csv (phase=measure rows)
// Writes results/<runId>/stamping-hashing/summary_pooled.json

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { config, parseArgs } from '../lib/config.mjs'
import { summarize } from '../lib/stats.mjs'
import { writeJson } from '../lib/output.mjs'

const { run } = parseArgs()
if (!run) throw new Error('Pass --run=<runId>')
const dir = path.join(config.resultsDir, run, 'stamping-hashing')
if (!existsSync(dir)) throw new Error(`No stamping-hashing results under ${dir}`)

const groups = {}
const perLaunch = {}
for (const launch of readdirSync(dir).filter((d) => d.startsWith('launch-')).sort()) {
  const lines = readFileSync(path.join(dir, launch, 'stamping_hashing_raw.csv'), 'utf8').trim().split('\n')
  const header = lines.shift().split(',')
  const col = Object.fromEntries(header.map((h, i) => [h, i]))
  for (const line of lines) {
    const c = line.split(',')
    if (c[col.phase] !== 'measure') continue
    const key = `${c[col.size_label]}|${c[col.operation]}`
    const ms = Number(c[col.nanos]) / 1e6
    ;(groups[key] ??= []).push(ms)
    ;((perLaunch[key] ??= {})[launch] ??= []).push(ms)
  }
}

const results = {}
for (const [key, values] of Object.entries(groups)) {
  const [size, op] = key.split('|')
  results[size] ??= {}
  results[size][`${op}_ms`] = {
    pooled: summarize(values),
    perLaunch: Object.fromEntries(Object.entries(perLaunch[key]).map(([l, v]) => [l, summarize(v)])),
  }
}
writeJson(path.join(dir, 'summary_pooled.json'), { runId: run, launches: Object.keys(Object.values(perLaunch)[0] ?? {}), results })
console.log(`Pooled summary written to ${path.join(dir, 'summary_pooled.json')}`)
