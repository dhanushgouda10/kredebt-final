// Local stand-in for Supabase Storage, so benchmarks never write to the real bucket.
//
// Implements exactly the three calls SupabaseStorageService makes:
//   POST   /storage/v1/object/{bucket}/{path}   upload (body = file bytes)
//   GET    /storage/v1/object/{bucket}/{path}   download
//   DELETE /storage/v1/object/{bucket}/{path}   delete
// Files are kept under benchmarks/.mock-storage-data/. Binds to 127.0.0.1 only.
// The Authorization header is required to be present (like Supabase) but its value is ignored.

import http from 'node:http'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { BENCH_DIR } from '../lib/config.mjs'

const PORT = Number(process.env.BENCH_MOCK_STORAGE_PORT ?? 54321)
const DATA_DIR = path.join(BENCH_DIR, '.mock-storage-data')
const PREFIX = '/storage/v1/object/'

mkdirSync(DATA_DIR, { recursive: true })

function resolveObject(urlPath) {
  const rel = decodeURIComponent(urlPath.slice(PREFIX.length))
  const target = path.resolve(DATA_DIR, rel)
  if (!target.startsWith(DATA_DIR + path.sep)) return null // no path traversal out of the data dir
  return target
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname
  if (!urlPath.startsWith(PREFIX)) return send(res, 404, { error: 'not found' })
  if (!req.headers.authorization) return send(res, 401, { error: 'missing authorization' })
  const file = resolveObject(urlPath)
  if (!file) return send(res, 400, { error: 'bad path' })

  if (req.method === 'POST' || req.method === 'PUT') {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, Buffer.concat(chunks))
      send(res, 200, { Key: urlPath.slice(PREFIX.length) })
    })
    return
  }
  if (req.method === 'GET') {
    if (!existsSync(file)) return send(res, 404, { error: 'not found' })
    return send(res, 200, readFileSync(file), 'application/pdf')
  }
  if (req.method === 'DELETE') {
    rmSync(file, { force: true })
    return send(res, 200, { message: 'deleted' })
  }
  send(res, 405, { error: 'method not allowed' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-storage] listening on http://127.0.0.1:${PORT} (data: ${DATA_DIR})`)
})
