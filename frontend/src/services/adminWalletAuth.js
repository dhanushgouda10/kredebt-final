import { requestAdminNonce, loginAdminWithSignature } from './authService'

/**
 * Admin wallet login orchestration: connect → challenge → sign → authenticate.
 *
 * Extracted from the login page so the sequence can be unit-tested with a mocked
 * `window.ethereum`, and so the page component stays presentational.
 *
 * Security notes:
 *  - `personal_sign` asks MetaMask to sign a human-readable challenge. The private
 *    key never leaves the wallet and is never seen by this app or the backend.
 *  - The signature is passed straight to the backend and never stored.
 *  - The nonce is single-use server-side, so a captured signature cannot be
 *    replayed on a later login attempt.
 */

/** MetaMask's code for "user clicked Reject on the popup". */
const USER_REJECTED = 4001

export class WalletAuthError extends Error {
  constructor(message, { cause } = {}) {
    super(message)
    this.name = 'WalletAuthError'
    this.cause = cause
  }
}

export function isMetaMaskAvailable(provider = globalThis.ethereum) {
  return Boolean(provider)
}

/**
 * Runs the full login sequence and resolves with the backend's auth response
 * (the same shape the previous address-only endpoint returned, so AuthContext
 * and downstream consumers are unaffected).
 *
 * `provider` is injectable purely so tests can supply a fake wallet.
 */
export async function loginAdmin(provider = globalThis.ethereum) {
  if (!isMetaMaskAvailable(provider)) {
    throw new WalletAuthError(
      'MetaMask is not installed. Please install the MetaMask browser extension to continue.',
    )
  }

  // 1 — Connect and read the selected account.
  let address
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    address = accounts?.[0]
  } catch (err) {
    if (err?.code === USER_REJECTED) {
      throw new WalletAuthError('Wallet connection was cancelled.', { cause: err })
    }
    throw new WalletAuthError('Could not connect to MetaMask.', { cause: err })
  }

  if (!address) {
    throw new WalletAuthError('No wallet account was selected in MetaMask.')
  }

  // 2 — Get a one-time challenge from the backend.
  const nonce = await requestAdminNonce(address)

  // 3 — Ask the wallet to sign it. Param order for personal_sign is
  //     [message, address] — reversing them makes MetaMask reject the request.
  let signature
  try {
    signature = await provider.request({
      method: 'personal_sign',
      params: [nonce, address],
    })
  } catch (err) {
    if (err?.code === USER_REJECTED) {
      throw new WalletAuthError(
        'Signature request was rejected. Signing proves you control this wallet, so it is required to sign in.',
        { cause: err },
      )
    }
    throw new WalletAuthError('Could not obtain a signature from MetaMask.', { cause: err })
  }

  if (!signature) {
    throw new WalletAuthError('MetaMask returned an empty signature.')
  }

  // 4 — Exchange the signed challenge for a session.
  return loginAdminWithSignature(address, signature)
}
