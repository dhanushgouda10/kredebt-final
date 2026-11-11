// Benchmark-only deployment of SkillChainCredential to a LOCAL Hardhat node.
//
//   npx hardhat node                                                   (terminal 1)
//   npx hardhat run scripts/bench/deploy-local.js --network localhost  (terminal 2)
//
// Refuses to run on any network other than the local Hardhat chain (chain ID 31337), so it can
// never touch Polygon Amoy or the existing Amoy deployment. It deploys with the node's first
// built-in, unlocked test account; no private key is read, stored or printed, and blockchain/.env
// is not used for anything here. The result is written to benchmarks/.local-chain.json.

const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  const { chainId } = await hre.ethers.provider.getNetwork()
  if (hre.network.name !== 'localhost' || chainId !== 31337n) {
    throw new Error(`Refusing to deploy: network "${hre.network.name}" (chain ${chainId}) is not the local Hardhat node.`)
  }

  const [deployer] = await hre.ethers.getSigners()
  const Contract = await hre.ethers.getContractFactory('SkillChainCredential', deployer)
  const contract = await Contract.deploy()
  await contract.waitForDeployment()

  const info = {
    network: 'hardhat-localhost',
    chainId: Number(chainId),
    rpcUrl: 'http://127.0.0.1:8545',
    contractAddress: (await contract.getAddress()).toLowerCase(),
    issuer: (await contract.issuer()).toLowerCase(),
    deployedAtUtc: new Date().toISOString(),
  }
  const out = path.resolve(__dirname, '..', '..', '..', 'benchmarks', '.local-chain.json')
  fs.writeFileSync(out, JSON.stringify(info, null, 2) + '\n')

  console.log('Local SkillChainCredential deployed:', info.contractAddress)
  console.log('Local issuer (Hardhat test account #0):', info.issuer)
  console.log('Written to', out)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
