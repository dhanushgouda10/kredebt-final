// Public, non-secret configuration for the SkillChain smart contract. None of these values
// are credentials — the contract address and network are meant to be publicly known (anyone
// can look them up on a block explorer anyway), so it's fine for them to live in the frontend.
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? ''
export const NETWORK_NAME = import.meta.env.VITE_NETWORK_NAME ?? 'Sepolia'
// Sepolia's chain ID is 11155111 (0xaa36a7 in hex, which is the format MetaMask's
// eth_chainId RPC call returns).
export const EXPECTED_CHAIN_ID_HEX = import.meta.env.VITE_CHAIN_ID_HEX ?? '0xaa36a7'
export const BLOCK_EXPLORER_URL = import.meta.env.VITE_BLOCK_EXPLORER_URL ?? 'https://sepolia.etherscan.io'
// Public Polygon Amoy RPC — only used as the required rpcUrls entry when asking MetaMask to add
// the network via wallet_addEthereumChain. Distinct from (and safe to be public, unlike) the
// backend's private Alchemy RPC URL, which is never exposed to the frontend.
export const AMOY_PUBLIC_RPC_URL = 'https://rpc-amoy.polygon.technology'

// Mirrors blockchain/contracts/SkillChainCredential.sol — only the functions/events the
// frontend actually calls or listens for are included.
export const CONTRACT_ABI = [
  'function issueCredential(string certificateId, string certificateHash, address studentWallet) returns (uint256)',
  'function revokeCredential(uint256 tokenId, string reason)',
  'function getCredential(uint256 tokenId) view returns (string certificateId, string certificateHash, address studentWallet, uint256 issuedAt, bool revoked, string revokeReason)',
  'function isValid(uint256 tokenId) view returns (bool)',
  'function issuer() view returns (address)',
  'function certificateIdToTokenId(string certificateId) view returns (uint256)',
  'event CredentialIssued(uint256 indexed tokenId, string certificateId, address indexed studentWallet, string certificateHash)',
  'event CredentialRevoked(uint256 indexed tokenId, string reason)',
]
