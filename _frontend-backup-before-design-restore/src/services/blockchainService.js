import { ethers } from 'ethers'
import {
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  EXPECTED_CHAIN_ID_HEX,
  NETWORK_NAME,
  BLOCK_EXPLORER_URL,
  AMOY_PUBLIC_RPC_URL,
} from '../contracts/skillChainConfig'

/**
 * All MetaMask / on-chain interaction lives in this one file. This is the ONLY place in the
 * whole app that touches window.ethereum for a transaction (AdminLoginPage.jsx separately uses
 * it just to read the connected address for login — unrelated to this).
 *
 * Nothing here ever asks for or sees a private key: window.ethereum + a MetaMask-backed
 * ethers.BrowserProvider means MetaMask itself signs everything, entirely inside the extension.
 * This code never has access to the signing key at any point.
 */

function getEthereumProvider() {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed. Please install the MetaMask browser extension to continue.')
  }
  return window.ethereum
}

function assertContractConfigured() {
  if (!CONTRACT_ADDRESS) {
    throw new Error('The smart contract address is not configured (VITE_CONTRACT_ADDRESS is missing).')
  }
}

/** Asks MetaMask which account is connected (prompts the connect popup if not already connected). */
export async function connectAdminWallet() {
  const ethereum = getEthereumProvider()
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
  if (!accounts || accounts.length === 0) {
    throw new Error('No MetaMask account was returned. Please unlock MetaMask and try again.')
  }
  return accounts[0]
}

/**
 * Ensures MetaMask's connected network matches EXPECTED_CHAIN_ID_HEX. If it doesn't, tries to
 * switch automatically via wallet_switchEthereumChain (this only prompts a MetaMask popup — it
 * never touches a private key). If MetaMask doesn't have the network at all yet (error code
 * 4902), falls back to wallet_addEthereumChain to add Polygon Amoy, then re-reads eth_chainId to
 * confirm the switch actually took effect before letting the caller proceed.
 */
async function ensureCorrectNetwork() {
  const ethereum = getEthereumProvider()
  const chainId = await ethereum.request({ method: 'eth_chainId' })
  if (chainId.toLowerCase() === EXPECTED_CHAIN_ID_HEX.toLowerCase()) {
    return
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: EXPECTED_CHAIN_ID_HEX }],
    })
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: EXPECTED_CHAIN_ID_HEX,
          chainName: NETWORK_NAME,
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          rpcUrls: [AMOY_PUBLIC_RPC_URL],
          blockExplorerUrls: [BLOCK_EXPLORER_URL],
        }],
      })
    } else {
      throw switchError
    }
  }

  const confirmedChainId = await ethereum.request({ method: 'eth_chainId' })
  if (confirmedChainId.toLowerCase() !== EXPECTED_CHAIN_ID_HEX.toLowerCase()) {
    throw new Error(`Wrong network selected in MetaMask. Please switch to ${NETWORK_NAME} and try again.`)
  }
}

/** Thrown whenever a required on-chain read can't be completed — RPC down, provider hiccup, etc.
 *  Callers must treat this as "cannot verify," never as "safe to proceed." */
function rpcUnavailableError(message) {
  const err = new Error(message)
  err.code = 'RPC_UNAVAILABLE'
  return err
}

/**
 * Reads the deployed contract's on-chain issuer directly — this is the ground truth for who is
 * authorized to mint/revoke, and stays correct even if the issuer is ever rotated later via
 * setIssuer(), without needing a second hardcoded copy of the admin address in frontend config.
 * Read-only: uses a plain provider, no signer needed.
 *
 * If this read itself fails (RPC down, provider hiccup), that must not be silently treated as
 * "any account is fine" — it throws a clear RPC_UNAVAILABLE error instead of letting the caller
 * fall through to a transaction attempt against a contract we couldn't actually verify.
 */
async function getAuthorizedIssuerAddress(ethereum) {
  const provider = new ethers.BrowserProvider(ethereum)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
  try {
    const issuer = await contract.issuer()
    return issuer.toLowerCase()
  } catch (error) {
    console.error('[blockchain] could not read issuer() from the contract', {
      reason: extractRevertReason(error),
    })
    throw rpcUnavailableError(
      'Blockchain RPC unavailable — could not verify the authorized issuer wallet. Please try again in a moment.'
    )
  }
}

async function readActiveAccount(ethereum) {
  const accounts = await ethereum.request({ method: 'eth_accounts' })
  return accounts?.[0]?.toLowerCase() ?? null
}

/**
 * Ensures the MetaMask account currently active for this site is the contract's authorized
 * issuer. eth_requestAccounts only re-prompts the account picker on a site's very first
 * connection — once a site is already connected, MetaMask silently keeps using whatever account
 * was last active for it, even if that's the wrong one, and nothing was previously checking the
 * returned address against the required admin/issuer wallet. That's the root cause of the
 * mismatch: connectAdminWallet() accepted accounts[0] unconditionally.
 *
 * If the wrong account is active, this calls wallet_requestPermissions to force MetaMask to
 * re-show its account picker (there is no MetaMask API to silently force-select one specific
 * account — only the user can do that). It then re-reads eth_accounts and, if the active account
 * still doesn't match, throws a clear error and refuses to proceed — the transaction is never
 * signed by the wrong wallet.
 *
 * Takes the already-resolved authorizedIssuer (see getAuthorizedIssuerAddress) so callers that
 * need that value for their own purposes — e.g. the issuance preflight's diagnostic log — don't
 * have to read it from the contract twice. Returns the confirmed active account (guaranteed to
 * equal authorizedIssuer if this resolves without throwing).
 */
async function ensureCorrectAccount(ethereum, authorizedIssuer) {
  let active = await readActiveAccount(ethereum)

  if (active !== authorizedIssuer) {
    try {
      await ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      })
    } catch {
      // User dismissed the account picker — fall through, the check below produces the clear error.
    }
    active = await readActiveAccount(ethereum)
  }

  if (active !== authorizedIssuer) {
    throw new Error(
      `Please connect the authorized admin wallet: ${authorizedIssuer}. MetaMask is currently using a different account.`
    )
  }

  return active
}

async function getSigner() {
  const ethereum = getEthereumProvider()
  await connectAdminWallet()
  await ensureCorrectNetwork()
  const authorizedIssuer = await getAuthorizedIssuerAddress(ethereum)
  await ensureCorrectAccount(ethereum, authorizedIssuer)
  const provider = new ethers.BrowserProvider(ethereum)
  return provider.getSigner()
}

/**
 * Subscribes to MetaMask's accountsChanged event so the UI can react (e.g. clear a stale
 * "wrong wallet" error) when the admin switches accounts. Returns an unsubscribe function; a
 * no-op if MetaMask isn't installed or doesn't support event subscriptions.
 */
export function onAccountsChanged(callback) {
  if (!window.ethereum?.on) {
    return () => {}
  }
  window.ethereum.on('accountsChanged', callback)
  return () => window.ethereum.removeListener?.('accountsChanged', callback)
}

/**
 * Best-effort search through ethers v6 / MetaMask's various nested error shapes for a human
 * revert reason string. Different failure paths populate different fields — a clean require()
 * revert usually gives error.reason or error.shortMessage, but some RPC providers return revert
 * data in a shape ethers can't fully parse, in which case ethers itself throws a low-level
 * "could not coalesce error" with none of the structured fields populated. This checks every
 * shape before ever falling back to the raw error.message, so that internal-ethers message is
 * only ever used as an absolute last resort (and toFriendlyError below filters it out even then).
 */
function extractRevertReason(error) {
  const candidates = [
    error?.reason,
    error?.shortMessage,
    error?.info?.error?.message,
    error?.error?.message,
    error?.error?.data?.message,
    error?.data?.message,
    typeof error?.data === 'string' ? error.data : null,
    error?.message,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate
    }
  }
  return ''
}

function isAlreadyMintedError(error) {
  return extractRevertReason(error).toLowerCase().includes('already minted')
}

/**
 * Maps SkillChainCredential.sol's exact require() strings (see blockchain/contracts/
 * SkillChainCredential.sol) to a specific, actionable message for the admin — instead of the
 * previous behavior of showing either the raw Solidity string or a generic "Action failed" with
 * no detail. Matched by substring, case-insensitively, against a decoded revert reason.
 * `plain` is the short label used by the preflight simulation's "Blockchain validation failed:
 * <reason>" message; `friendly` is the fuller sentence used by toFriendlyError for a real
 * transaction failure or a revoke failure.
 */
const REVERT_REASON_MAP = [
  { match: 'caller is not the authorized issuer', plain: 'Unauthorized issuer', friendly: 'Admin wallet is not the authorized issuer for this contract. Connect the correct MetaMask account.' },
  { match: 'invalid student wallet', plain: 'Invalid student wallet', friendly: 'Student wallet address is invalid (empty or zero address) — cannot issue to it.' },
  { match: 'certificateid required', plain: 'Certificate ID is required', friendly: 'Certificate ID is missing — cannot issue on-chain.' },
  { match: 'certificatehash required', plain: 'Certificate hash is required', friendly: 'Certificate hash is missing — upload the certificate PDF first.' },
  { match: 'certificate already minted', plain: 'Certificate already minted', friendly: 'This certificate has already been minted on the blockchain.' },
]

function mapKnownReason(reason) {
  const lower = reason.toLowerCase()
  const mapped = REVERT_REASON_MAP.find((entry) => lower.includes(entry.match))
  return mapped ? mapped.plain : reason.replace('execution reverted: ', '')
}

// Standard Solidity `require(condition, "message")` / `revert("message")` ABI-encodes its string
// argument behind the 4-byte selector for Error(string) — 0x08c379a0. Some error shapes (in
// particular a raw eth_call revert surfaced through error.data or error.info.error.data without
// ethers already having decoded it into .reason/.revert) only give us this raw hex, so this
// decodes it by hand as a last resort before giving up.
const ERROR_STRING_SELECTOR = '0x08c379a0'

function decodeErrorStringFromHexData(data) {
  if (typeof data !== 'string' || !data.startsWith(ERROR_STRING_SELECTOR)) {
    return null
  }
  try {
    const [decoded] = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + data.slice(10))
    return decoded
  } catch {
    return null
  }
}

/**
 * Robustly extracts a human-readable revert reason from an ethers v6 CALL_EXCEPTION (or similar)
 * error, checking every shape ethers/MetaMask/various RPC providers are known to populate —
 * error.revert (ethers' own decoded Error(string) result), error.reason, error.shortMessage,
 * error.data / error.info.error.data / error.error.data (raw hex, decoded by hand if needed),
 * error.info.error.message, error.error.message, and finally error.message. Used specifically by
 * the preflight staticCall simulation in issueCredentialOnChain, where the goal is the actual
 * Solidity require() text, not just "something failed."
 */
function decodeRevertReason(error) {
  const rawDataCandidates = [error?.data, error?.info?.error?.data, error?.error?.data]
  for (const raw of rawDataCandidates) {
    const decoded = decodeErrorStringFromHexData(raw)
    if (decoded) {
      return mapKnownReason(decoded)
    }
  }

  const textCandidates = [
    error?.revert?.args?.[0],
    error?.reason,
    error?.shortMessage,
    error?.info?.error?.message,
    error?.error?.message,
    error?.error?.data?.message,
    error?.data?.message,
    typeof error?.data === 'string' ? error.data : null,
    error?.message,
  ]
  for (const candidate of textCandidates) {
    if (typeof candidate === 'string' && candidate.trim() && !candidate.toLowerCase().includes('could not coalesce')) {
      return mapKnownReason(candidate)
    }
  }

  return 'unknown error (no revert reason could be decoded from MetaMask or the RPC provider)'
}

/** Turns ethers/MetaMask's various error shapes into one readable, specific sentence for the UI. */
function toFriendlyError(error) {
  const code = error?.code
  if (code === 'ACTION_REJECTED' || code === 4001) {
    return new Error('Transaction was rejected in MetaMask.')
  }
  if (code === 'RPC_UNAVAILABLE') {
    return new Error(error.message)
  }

  const reason = extractRevertReason(error)
  const lowerReason = reason.toLowerCase()

  // Ethers' own internal "could not coalesce error" (thrown when it can't parse an RPC
  // provider's error response) is not useful to show — it's not a revert reason, just ethers
  // giving up on normalizing the underlying error. Never surface it as if it were one.
  if (reason && !lowerReason.includes('could not coalesce')) {
    const mapped = REVERT_REASON_MAP.find((entry) => lowerReason.includes(entry.match))
    if (mapped) {
      return new Error(mapped.friendly)
    }
    return new Error(`Transaction reverted: ${reason.replace('execution reverted: ', '')}`)
  }

  // No usable reason at all — this is what MetaMask's own "Interaction failed" screen (a
  // simulated revert caught during gas estimation, before a normal confirm screen ever appears)
  // often looks like: the error object handed back to ethers doesn't always carry a cleanly
  // decoded revert string. A dropped/unreachable RPC produces the same shape.
  if (code === 'NETWORK_ERROR' || code === 'SERVER_ERROR' || code === 'TIMEOUT') {
    return new Error('Blockchain RPC unavailable. Please try again in a moment.')
  }
  return new Error('The blockchain transaction failed and no further detail was available from MetaMask or the RPC provider. Please try again.')
}

/**
 * Fast, clear, client-side rejection of obviously-bad parameters before ever touching MetaMask —
 * so a missing/invalid value produces one of these specific messages instead of an opaque
 * contract revert (or, worse, an opaque MetaMask "Interaction failed" with no message at all).
 * Mirrors the contract's own require() checks (see SkillChainCredential.sol issueCredential),
 * just enforced a step earlier.
 */
function validateIssueParams({ certificateId, certificateHash, studentWalletAddress }) {
  if (!certificateId || !String(certificateId).trim()) {
    throw new Error('Certificate ID is missing — cannot issue on-chain.')
  }
  if (!certificateHash || !String(certificateHash).trim()) {
    throw new Error('Certificate hash is missing — upload the certificate PDF first.')
  }
  if (!studentWalletAddress || !ethers.isAddress(studentWalletAddress)) {
    throw new Error('Student wallet address is invalid or missing.')
  }
  if (studentWalletAddress.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
    throw new Error('Student wallet address is invalid (zero address) — cannot issue to it.')
  }
}

// Polygon Amoy's current RPC enforces a minimum priority fee (gas tip cap) of 25 gwei —
// confirmed directly from the live MetaMask RPC error: "gas tip cap 1500000000, minimum needed
// 25000000000" (1.5 gwei vs. the required 25 gwei). 1.5 gwei is ethers v6's own hardcoded
// fallback maxPriorityFeePerGas, used whenever a provider's fee suggestion isn't high enough to
// begin with — it's too low for Amoy's current minimum, which is why the staticCall simulation
// (a plain eth_call, no gas pricing involved) succeeded while the real transaction was rejected
// at the RPC layer before ever reaching the contract. This is a network fee-policy issue, not a
// contract or business-logic one, so it's handled here as a small, explicit fee override applied
// to the two transactions this file actually sends (issueCredential, revokeCredential).
const AMOY_MIN_PRIORITY_FEE = ethers.parseUnits('25', 'gwei')

/**
 * Builds EIP-1559 fee overrides that satisfy Polygon Amoy's current minimum priority fee.
 *
 * Deliberately does NOT call provider.getFeeData() — ethers v6's getFeeData() tries to source a
 * network-suggested priority fee via the eth_maxPriorityFeePerGas RPC method, and Polygon Amoy's
 * current RPC does not implement it ("The method eth_maxPriorityFeePerGas does not exist / is
 * not available"), which surfaced as a MetaMask RPC error even though the staticCall preflight
 * and the earlier flat 1.5 gwei default both looked fine on the surface.
 *
 * The only RPC call this makes is eth_getBlockByNumber (via provider.getBlock('latest')), which
 * every RPC provider supports and which is all that's actually needed here: the current
 * baseFeePerGas. There is no supported way to read the network's own suggested priority fee from
 * this RPC, so the priority fee is fixed at Amoy's confirmed required minimum of 25 gwei (from
 * the earlier "gas tip cap 1500000000, minimum needed 25000000000" rejection) rather than left
 * unset or guessed. maxFeePerGas covers baseFeePerGas + maxPriorityFeePerGas with a 2x base-fee
 * safety buffer for base fee movement across the next few blocks — not an unnecessarily huge
 * flat number.
 */
async function getAmoyFeeOverrides(provider) {
  const latestBlock = await provider.getBlock('latest')
  const baseFeePerGas = latestBlock?.baseFeePerGas ?? AMOY_MIN_PRIORITY_FEE

  const maxPriorityFeePerGas = AMOY_MIN_PRIORITY_FEE
  const maxFeePerGas = baseFeePerGas * 2n + maxPriorityFeePerGas

  return { maxPriorityFeePerGas, maxFeePerGas, baseFeePerGas }
}

/** Pulls the token ID out of a mint receipt's CredentialIssued event log. */
function extractTokenIdFromReceipt(contract, receipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log)
      if (parsed?.name === 'CredentialIssued') {
        return parsed.args.tokenId.toString()
      }
    } catch {
      // Not one of our contract's events (could be from another contract in the same block) — skip it.
    }
  }
  return null
}

/**
 * Read-only pre-check: is this certificateId already minted? Called BEFORE ever attempting a
 * transaction, so an already-minted certificate never gets a doomed-to-revert issueCredential()
 * sent at all. Returns the existing tokenId (string) if minted, or null if the contract confirms
 * it is NOT minted.
 *
 * FAILS CLOSED: this used to swallow a failed read and return null, treating "couldn't check" the
 * same as "confirmed not minted" — which let a doomed (or even a genuinely duplicate) transaction
 * reach MetaMask on a plain RPC hiccup, with no clear explanation of why it then reverted. It now
 * throws RPC_UNAVAILABLE instead, and the caller must not proceed to a mint attempt when it can't
 * actually verify the certificate's on-chain state first.
 */
async function checkExistingTokenId(contract, certificateId) {
  try {
    const tokenId = await contract.certificateIdToTokenId(certificateId)
    return tokenId && tokenId !== 0n ? tokenId.toString() : null
  } catch (error) {
    console.error('[blockchain] certificateIdToTokenId pre-check failed — refusing to risk a mint attempt', {
      certificateId,
      reason: extractRevertReason(error),
    })
    throw rpcUnavailableError(
      "Could not verify this certificate's blockchain state before minting (the RPC read failed). " +
        'Please try again in a moment.'
    )
  }
}

/**
 * Recovers an already-minted credential's on-chain record for a certificateId that the contract
 * says is already minted (certificateIdToTokenId != 0), but that this app never got to record
 * against the certificate row — e.g. an earlier attempt where the mint transaction succeeded but
 * the follow-up backend verification call failed for an unrelated reason (RPC/config issue,
 * network blip) before the certificate could be marked MINTED. Read-only: looks up the existing
 * tokenId (unless already known), then finds that mint's original transaction hash from its
 * CredentialIssued event log. Never sends a transaction.
 */
async function recoverExistingMint(contract, certificateId, knownTokenId) {
  let tokenId = knownTokenId
  if (tokenId === undefined || tokenId === null) {
    try {
      const raw = await contract.certificateIdToTokenId(certificateId)
      if (!raw || raw === 0n) {
        throw new Error('not minted')
      }
      tokenId = raw.toString()
    } catch (error) {
      throw new Error(
        'This certificate is already minted on-chain, but its token ID could not be read from the ' +
          'contract right now. Please try again in a moment.',
        { cause: error }
      )
    }
  }

  // Thrown when the tokenId is confirmed (certificateIdToTokenId != 0 — this certificate is
  // definitely already minted) but the transaction hash itself couldn't be found automatically.
  // Tagged with a `code` plus the already-confirmed tokenId/contractAddress so the caller can
  // offer a manual-reconciliation path (e.g. pasting the hash from a block explorer) instead of
  // treating this as a dead end — the mint is real, only the auto-lookup failed.
  function needsManualTxHash(cause) {
    const err = new Error(
      `This certificate is already minted on-chain (token ID ${tokenId}), but the transaction hash could ` +
        "not be recovered automatically from the contract's event history — the RPC provider may not " +
        'support looking up past events. If the transaction hash is already known (e.g. from the block ' +
        'explorer), it can be entered manually to finish recording this certificate as minted.',
      cause ? { cause } : undefined
    )
    err.code = 'ALREADY_MINTED_NEEDS_TX_HASH'
    err.tokenId = tokenId
    err.contractAddress = CONTRACT_ADDRESS
    return err
  }

  let events
  try {
    events = await contract.queryFilter(contract.filters.CredentialIssued(tokenId))
  } catch (error) {
    // Some RPC providers (especially free/public ones) limit or reject queryFilter's block-range
    // eth_getLogs call — don't let that raw provider error (or ethers' "could not coalesce
    // error" while trying to parse it) surface as-is.
    console.error('[blockchain] queryFilter failed while recovering existing mint', {
      certificateId,
      tokenId,
      reason: extractRevertReason(error),
    })
    throw needsManualTxHash(error)
  }

  const original = events[0]
  if (!original) {
    throw needsManualTxHash()
  }

  console.info('[blockchain] recovered existing mint', {
    certificateId,
    tokenId,
    contractAddress: CONTRACT_ADDRESS,
    transactionHash: original.transactionHash,
  })

  return {
    transactionHash: original.transactionHash,
    tokenId,
    contractAddress: CONTRACT_ADDRESS,
  }
}

/**
 * Calls issueCredential() on-chain, signed and submitted by the admin's MetaMask. Returns the
 * transaction hash and the newly minted token ID (read from the CredentialIssued event in the
 * mined receipt) so the caller can report them to the backend for verification + storage.
 *
 * Flow (each step must pass before the next runs):
 *   1-2. Connect MetaMask, confirm it's on Polygon Amoy.
 *   3-5. Read the contract's issuer() and make sure the active MetaMask account matches it.
 *   6.   Validate certificateId / certificateHash / studentWalletAddress client-side.
 *   7-9. Read certificateIdToTokenId(certificateId). Fails CLOSED: an RPC read failure stops
 *        here rather than guessing; a nonzero tokenId means it's already minted, so this
 *        recovers the existing record rather than ever minting it again.
 *   10-11. STATIC CALL simulation of issueCredential(...) with the exact same three parameters,
 *        via the exact same signer/contract — a plain eth_call ethers issues and decodes itself,
 *        entirely independent of MetaMask's own internal gas-estimation UI (the source of the
 *        opaque "Interaction failed" screen with no usable detail). If this reverts, the reason
 *        is decoded and thrown immediately — the real transaction is NEVER sent and MetaMask's
 *        confirm popup NEVER opens.
 *   12-14. Only once the simulation succeeds: send the real transaction and wait for the receipt.
 */
export async function issueCredentialOnChain({ certificateId, certificateHash, studentWalletAddress }) {
  assertContractConfigured()
  validateIssueParams({ certificateId, certificateHash, studentWalletAddress })

  const ethereum = getEthereumProvider()

  // Steps 1-2.
  await connectAdminWallet()
  await ensureCorrectNetwork()

  // Steps 3-5.
  const authorizedIssuer = await getAuthorizedIssuerAddress(ethereum)
  const connectedAccount = await ensureCorrectAccount(ethereum, authorizedIssuer)

  const provider = new ethers.BrowserProvider(ethereum)
  const signer = await provider.getSigner()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

  // Steps 7-9. FAILS CLOSED — an RPC failure here stops the whole flow, it does not fall through
  // to a transaction attempt we can't actually verify is safe.
  let existingTokenId
  try {
    existingTokenId = await checkExistingTokenId(contract, certificateId)
  } catch (error) {
    if (error?.code === 'RPC_UNAVAILABLE') {
      throw new Error('Unable to read certificate state from Polygon Amoy. Transaction was not sent.', { cause: error })
    }
    throw error
  }

  // Safe diagnostic snapshot, logged before any simulation/transaction is attempted. Deliberately
  // logs certificateHash's LENGTH only, never the hash value itself.
  console.info('[blockchain] issuance preflight', {
    contractAddress: CONTRACT_ADDRESS,
    connectedAccount,
    authorizedIssuer,
    certificateId,
    studentWalletAddress,
    certificateHashLength: certificateHash?.length ?? 0,
    existingTokenId,
  })

  if (existingTokenId !== null) {
    // Already minted on-chain — never mint again. Recover the existing record instead (either
    // automatically from event logs, or via the manual-reconciliation path if that lookup itself
    // can't complete), so a database that's merely out of sync with the chain gets fixed instead
    // of a duplicate transaction being attempted.
    console.info('[blockchain] certificate already minted, recovering existing record instead of minting again', {
      certificateId,
      tokenId: existingTokenId,
      contractAddress: CONTRACT_ADDRESS,
    })
    return await recoverExistingMint(contract, certificateId, existingTokenId)
  }

  // Steps 10-11: preflight simulation. A plain read-only eth_call — no MetaMask popup, no gas
  // spent, no state change. If it reverts, we stop right here with a decoded reason.
  try {
    await contract.issueCredential.staticCall(certificateId, certificateHash, studentWalletAddress)
  } catch (simulationError) {
    const code = simulationError?.code
    let message
    if (code === 'ACTION_REJECTED' || code === 4001) {
      message = 'Transaction was rejected in MetaMask.'
    } else if (code === 'INSUFFICIENT_FUNDS') {
      message = 'Insufficient POL balance to pay for gas on Polygon Amoy.'
    } else if (code === 'NETWORK_ERROR' || code === 'SERVER_ERROR' || code === 'TIMEOUT') {
      message = 'Blockchain RPC unavailable. Please try again in a moment.'
    } else {
      // Covers CALL_EXCEPTION and UNKNOWN_ERROR alike — decodeRevertReason checks every shape
      // (error.revert, .reason, .shortMessage, .data, .info.error.data/.message, .error.data/
      // .message, nested objects) rather than assuming any single one is populated.
      message = `Blockchain validation failed: ${decodeRevertReason(simulationError)}`
    }
    console.error('[blockchain] issueCredential preflight simulation reverted — real transaction was NOT sent', {
      certificateId,
      code,
      message,
    })
    throw new Error(message, { cause: simulationError })
  }

  // Steps 12-14: simulation succeeded — safe to send the real transaction. Amoy's RPC requires
  // a minimum 25 gwei priority fee (see getAmoyFeeOverrides) — without this, ethers' own default
  // fee suggestion (~1.5 gwei) gets the transaction rejected at the RPC layer, after the
  // staticCall simulation above has already succeeded (the simulation is a plain eth_call and
  // never involves gas pricing, so it can't catch this).
  let receipt
  try {
    const feeOverrides = await getAmoyFeeOverrides(provider)
    console.info('[blockchain] transaction fee overrides', {
      maxPriorityFeePerGas: `${ethers.formatUnits(feeOverrides.maxPriorityFeePerGas, 'gwei')} gwei`,
      maxFeePerGas: `${ethers.formatUnits(feeOverrides.maxFeePerGas, 'gwei')} gwei`,
      baseFeePerGas: `${ethers.formatUnits(feeOverrides.baseFeePerGas, 'gwei')} gwei`,
    })
    const tx = await contract.issueCredential(certificateId, certificateHash, studentWalletAddress, {
      maxPriorityFeePerGas: feeOverrides.maxPriorityFeePerGas,
      maxFeePerGas: feeOverrides.maxFeePerGas,
    })
    receipt = await tx.wait()
  } catch (mintError) {
    if (isAlreadyMintedError(mintError)) {
      return await recoverExistingMint(contract, certificateId)
    }
    console.error('[blockchain] issueCredential transaction failed after a successful simulation', {
      certificateId,
      code: mintError?.code,
      reason: extractRevertReason(mintError),
    })
    throw toFriendlyError(mintError)
  }

  const tokenId = extractTokenIdFromReceipt(contract, receipt)
  if (!tokenId) {
    throw new Error('Transaction succeeded but the CredentialIssued event was not found — cannot determine the token ID.')
  }

  console.info('[blockchain] mint succeeded', {
    certificateId,
    tokenId,
    contractAddress: CONTRACT_ADDRESS,
    transactionHash: receipt.hash,
  })

  return {
    transactionHash: receipt.hash,
    tokenId,
    contractAddress: CONTRACT_ADDRESS,
  }
}

/** Calls revokeCredential() on-chain, signed and submitted by the admin's MetaMask. */
export async function revokeCredentialOnChain({ tokenId, reason }) {
  assertContractConfigured()
  try {
    const signer = await getSigner()
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

    // Same Amoy minimum-priority-fee requirement as issueCredentialOnChain — see
    // getAmoyFeeOverrides for why this is needed.
    const feeOverrides = await getAmoyFeeOverrides(signer.provider)
    console.info('[blockchain] transaction fee overrides', {
      maxPriorityFeePerGas: `${ethers.formatUnits(feeOverrides.maxPriorityFeePerGas, 'gwei')} gwei`,
      maxFeePerGas: `${ethers.formatUnits(feeOverrides.maxFeePerGas, 'gwei')} gwei`,
      baseFeePerGas: `${ethers.formatUnits(feeOverrides.baseFeePerGas, 'gwei')} gwei`,
    })
    const tx = await contract.revokeCredential(tokenId, reason, {
      maxPriorityFeePerGas: feeOverrides.maxPriorityFeePerGas,
      maxFeePerGas: feeOverrides.maxFeePerGas,
    })
    const receipt = await tx.wait()

    return { transactionHash: receipt.hash }
  } catch (error) {
    throw toFriendlyError(error)
  }
}
