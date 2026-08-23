import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loginAdmin, isMetaMaskAvailable, WalletAuthError } from './adminWalletAuth'
import { requestAdminNonce, loginAdminWithSignature } from './authService'

vi.mock('./authService', () => ({
  requestAdminNonce: vi.fn(),
  loginAdminWithSignature: vi.fn(),
}))

const ADDRESS = '0xaB07a51fd2daBCceF287f0D3FFbce0a6D3297C3B'
const NONCE = 'Sign in to Kredent: 7f3a9c2e-...'
const SIGNATURE = '0xdeadbeef'

/** Minimal fake EIP-1193 provider. */
function fakeWallet({ accounts = [ADDRESS], signature = SIGNATURE, rejectOn = null } = {}) {
  return {
    request: vi.fn(async ({ method }) => {
      if (rejectOn === method) {
        const err = new Error('User rejected the request.')
        err.code = 4001
        throw err
      }
      if (method === 'eth_requestAccounts') return accounts
      if (method === 'personal_sign') return signature
      throw new Error(`unexpected method ${method}`)
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  requestAdminNonce.mockResolvedValue(NONCE)
  loginAdminWithSignature.mockResolvedValue({ token: 'jwt', role: 'ADMIN' })
})

describe('isMetaMaskAvailable', () => {
  it('is false when no provider is injected', () => {
    expect(isMetaMaskAvailable(undefined)).toBe(false)
  })

  it('is true when a provider exists', () => {
    expect(isMetaMaskAvailable({})).toBe(true)
  })
})

describe('loginAdmin', () => {
  it('runs connect → nonce → sign → authenticate in order', async () => {
    const wallet = fakeWallet()

    const result = await loginAdmin(wallet)

    expect(wallet.request).toHaveBeenNthCalledWith(1, { method: 'eth_requestAccounts' })
    expect(requestAdminNonce).toHaveBeenCalledWith(ADDRESS)
    expect(wallet.request).toHaveBeenNthCalledWith(2, {
      method: 'personal_sign',
      params: [NONCE, ADDRESS],
    })
    expect(loginAdminWithSignature).toHaveBeenCalledWith(ADDRESS, SIGNATURE)
    expect(result).toEqual({ token: 'jwt', role: 'ADMIN' })
  })

  it('signs the exact nonce the server issued', async () => {
    requestAdminNonce.mockResolvedValue('a-different-challenge')
    const wallet = fakeWallet()

    await loginAdmin(wallet)

    const signCall = wallet.request.mock.calls.find(([a]) => a.method === 'personal_sign')
    expect(signCall[0].params[0]).toBe('a-different-challenge')
  })

  it('passes personal_sign params as [message, address], not reversed', async () => {
    const wallet = fakeWallet()

    await loginAdmin(wallet)

    const signCall = wallet.request.mock.calls.find(([a]) => a.method === 'personal_sign')
    const [message, address] = signCall[0].params
    expect(message).toBe(NONCE)
    expect(address).toBe(ADDRESS)
  })

  it('throws a clear error when MetaMask is absent', async () => {
    await expect(loginAdmin(undefined)).rejects.toThrow(WalletAuthError)
    await expect(loginAdmin(undefined)).rejects.toThrow(/MetaMask is not installed/i)
  })

  it('never requests a nonce if the wallet is absent', async () => {
    await expect(loginAdmin(undefined)).rejects.toThrow()
    expect(requestAdminNonce).not.toHaveBeenCalled()
  })

  it('surfaces a cancellation message when the user rejects the connection', async () => {
    const wallet = fakeWallet({ rejectOn: 'eth_requestAccounts' })
    await expect(loginAdmin(wallet)).rejects.toThrow(/cancelled/i)
  })

  it('explains why signing is required when the user rejects the signature', async () => {
    const wallet = fakeWallet({ rejectOn: 'personal_sign' })
    await expect(loginAdmin(wallet)).rejects.toThrow(/proves you control this wallet/i)
  })

  it('does not attempt authentication when signing is rejected', async () => {
    const wallet = fakeWallet({ rejectOn: 'personal_sign' })
    await expect(loginAdmin(wallet)).rejects.toThrow()
    expect(loginAdminWithSignature).not.toHaveBeenCalled()
  })

  it('rejects when no account is selected', async () => {
    const wallet = fakeWallet({ accounts: [] })
    await expect(loginAdmin(wallet)).rejects.toThrow(/no wallet account/i)
  })

  it('rejects an empty signature rather than sending it', async () => {
    const wallet = fakeWallet({ signature: '' })
    await expect(loginAdmin(wallet)).rejects.toThrow(/empty signature/i)
    expect(loginAdminWithSignature).not.toHaveBeenCalled()
  })

  it('propagates a backend rejection (e.g. unknown wallet, bad signature)', async () => {
    loginAdminWithSignature.mockRejectedValue(new Error('This wallet is not registered as an admin'))
    const wallet = fakeWallet()
    await expect(loginAdmin(wallet)).rejects.toThrow(/not registered as an admin/i)
  })
})
