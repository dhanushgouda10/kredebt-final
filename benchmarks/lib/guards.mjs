// Safety checks shared by every benchmark script. They make it impossible for these scripts to
// talk to Polygon Amoy, Supabase, or any non-local backend, whatever the environment says.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
export const LOCAL_CHAIN_ID = 31337n

export function assertLocalUrl(name, value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} is not a valid URL`)
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    // Deliberately does not echo the value: it could be a provider URL with an embedded key.
    throw new Error(`${name} must point at localhost / 127.0.0.1 for benchmarks. Refusing to run.`)
  }
}

export async function assertLocalChain(rpcUrl) {
  assertLocalUrl('BENCH_RPC_URL', rpcUrl)
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
  })
  const body = await res.json()
  const chainId = BigInt(body.result)
  if (chainId !== LOCAL_CHAIN_ID) {
    throw new Error(`RPC reports chain ID ${chainId}, expected the local Hardhat chain (31337). Refusing to run.`)
  }
}
