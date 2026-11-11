import { config } from './config.mjs'

export class ApiError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} -> HTTP ${status}: ${String(body).slice(0, 300)}`)
    this.status = status
  }
}

export async function api(method, path, { token, json, form } = {}) {
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`
  let body
  if (json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }
  const res = await fetch(config.apiBase + path, { method, headers, body })
  const text = await res.text()
  if (!res.ok) throw new ApiError(method, path, res.status, text)
  return text ? JSON.parse(text) : null
}
