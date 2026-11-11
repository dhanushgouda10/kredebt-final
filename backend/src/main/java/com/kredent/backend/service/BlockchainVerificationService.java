package com.kredent.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.Utf8String;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.protocol.http.HttpService;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Read-only blockchain access. This class NEVER holds a private key and NEVER submits a
 * transaction — the admin's MetaMask has already signed and submitted the transaction directly
 * from the browser (see frontend/src/services/blockchainService.js) by the time anything here
 * runs. All this does is read the transaction receipt back from the RPC endpoint and confirm:
 *
 *   1. the transaction actually succeeded on-chain (status == success), and
 *   2. it was sent TO our exact smart contract address, and
 *   3. it was sent FROM the configured authorized admin wallet.
 *
 * This stops a compromised or buggy frontend from simply POSTing a made-up transaction hash
 * (or a real hash for some *other* unrelated transaction) and having the backend blindly mark a
 * certificate as blockchain-issued.
 *
 * Known simplification (documented on purpose): this does not decode the contract's event logs
 * to independently re-derive the token ID — it trusts the token ID the frontend reports, once
 * the three checks above pass. Since only the authorized admin wallet can ever get a successful
 * receipt from this contract in the first place, a full event-log decode would add more
 * complexity than value for a project at this stage; it's a natural next hardening step.
 */
@Service
public class BlockchainVerificationService {

    private static final Logger log = LoggerFactory.getLogger(BlockchainVerificationService.class);

    private static final String SUCCESS_STATUS_HEX = "0x1";
    private static final String SUCCESS_STATUS_PLAIN = "1";

    private final Web3j web3j;
    private final String contractAddress;
    private final String adminWalletAddress;
    private final boolean configured;

    public BlockchainVerificationService(
            @Value("${blockchain.rpc-url:}") String rpcUrl,
            @Value("${blockchain.contract-address:}") String contractAddress,
            @Value("${blockchain.admin-wallet-address:}") String adminWalletAddress) {
        this.contractAddress = contractAddress == null ? "" : contractAddress.toLowerCase();
        this.adminWalletAddress = adminWalletAddress == null ? "" : adminWalletAddress.toLowerCase();
        this.configured = rpcUrl != null && !rpcUrl.isBlank() && !this.contractAddress.isBlank();
        this.web3j = this.configured ? Web3j.build(new HttpService(rpcUrl)) : null;

        // Diagnostic-only, logged once at startup — never logs the RPC URL itself (it may embed
        // a provider API key), just whether it's present. This turns a misconfiguration that
        // would otherwise only surface later as an opaque 503 on the first mint attempt into
        // something visible immediately in the console at boot.
        if (configured) {
            log.info("Blockchain verification configured: contract={}, adminWallet={}, rpcUrlSet=true",
                    this.contractAddress, this.adminWalletAddress.isBlank() ? "(not set)" : this.adminWalletAddress);
        } else {
            log.warn("Blockchain verification NOT configured (rpcUrlSet={}, contractAddressSet={}). "
                            + "Every /blockchain/issue and /blockchain/revoke request will fail with 503 until "
                            + "BLOCKCHAIN_RPC_URL is set as a real environment variable and the backend is restarted.",
                    rpcUrl != null && !rpcUrl.isBlank(), !this.contractAddress.isBlank());
        }
    }

    /** Confirms a transaction hash really is a successful call into our contract, from the authorized admin wallet. */
    /** The configured contract address (lower-case), or empty if blockchain verification is not configured. */
    public String contractAddress() {
        return contractAddress;
    }

    /**
     * After the transaction itself has been verified, reads the credential back from the contract and
     * checks it is really the one the administrator claims: same certificate id, same SHA-256 hash and
     * same student wallet. Without this the backend would trust a client-supplied tokenId / hash.
     */
    public void verifyIssuedCredential(long tokenId, String certificateId, String certificateHash, String studentWallet) {
        OnChainCredential onChain = readCredential(tokenId).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Could not read credential #" + tokenId + " from the blockchain to confirm it. Please try again in a moment."));
        if (!onChain.certificateId().equalsIgnoreCase(certificateId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "On-chain token " + tokenId + " belongs to a different certificate");
        }
        if (!onChain.certificateHash().equalsIgnoreCase(certificateHash)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "On-chain hash does not match the stored SHA-256 hash of this certificate");
        }
        if (!onChain.studentWallet().equalsIgnoreCase(studentWallet)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "On-chain student wallet does not match this student's wallet on file");
        }
        if (onChain.revoked()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This credential is already revoked on-chain");
        }
    }

    /** After a revoke transaction: the credential must really be revoked on-chain. */
    public void verifyRevokedOnChain(long tokenId) {
        OnChainCredential onChain = readCredential(tokenId).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Could not read credential #" + tokenId + " from the blockchain to confirm the revocation. Please try again in a moment."));
        if (!onChain.revoked()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The blockchain does not show this credential as revoked");
        }
    }

    public void verifyContractTransaction(String transactionHash) {
        verifyContractTransaction(transactionHash, null);
    }

    /**
     * @param expectedSender the wallet that must have sent the transaction — the signed-in institution's
     *                       linked wallet. When null/blank, falls back to blockchain.admin-wallet-address.
     */
    public void verifyContractTransaction(String transactionHash, String expectedSender) {
        if (!configured) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Blockchain is not configured on the server (BLOCKCHAIN_RPC_URL / SMART_CONTRACT_ADDRESS missing)");
        }
        if (transactionHash == null || transactionHash.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing transaction hash");
        }

        TransactionReceipt receipt = fetchReceipt(transactionHash);

        String status = receipt.getStatus();
        boolean succeeded = SUCCESS_STATUS_HEX.equalsIgnoreCase(status) || SUCCESS_STATUS_PLAIN.equals(status);
        if (!succeeded) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That transaction did not succeed on-chain (status: " + status + ")");
        }

        String to = receipt.getTo() == null ? "" : receipt.getTo().toLowerCase();
        if (!to.equals(contractAddress)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That transaction was not sent to the SkillChain smart contract");
        }

        String requiredSender = (expectedSender != null && !expectedSender.isBlank())
                ? expectedSender.toLowerCase()
                : adminWalletAddress;
        if (!requiredSender.isBlank()) {
            String from = receipt.getFrom() == null ? "" : receipt.getFrom().toLowerCase();
            if (!from.equals(requiredSender)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "That transaction was not sent from your institution's linked wallet");
            }
        }
    }

    /** Independently-read credential state straight from the contract — see readCredential(). */
    public record OnChainCredential(String certificateId, String certificateHash, String studentWallet, boolean revoked) {}

    /**
     * Reads a credential directly from the deployed contract's getCredential(tokenId) — used by
     * public verification (PublicVerificationService) to confirm a certificate's on-chain state
     * without trusting PostgreSQL alone. Pure read-only eth_call, never a transaction, never a
     * private key. Returns empty if verification isn't configured, the RPC call fails, or the
     * token doesn't exist on-chain — callers must treat an empty result as "could not verify",
     * never as confirmation of authenticity.
     */
    public Optional<OnChainCredential> readCredential(long tokenId) {
        if (!configured) {
            return Optional.empty();
        }
        try {
            Function function = new Function(
                    "getCredential",
                    List.of(new Uint256(BigInteger.valueOf(tokenId))),
                    Arrays.asList(
                            new TypeReference<Utf8String>() {},
                            new TypeReference<Utf8String>() {},
                            new TypeReference<Address>() {},
                            new TypeReference<Uint256>() {},
                            new TypeReference<Bool>() {},
                            new TypeReference<Utf8String>() {}));

            String encodedFunction = FunctionEncoder.encode(function);
            EthCall response = web3j.ethCall(
                            Transaction.createEthCallTransaction(null, contractAddress, encodedFunction),
                            DefaultBlockParameterName.LATEST)
                    .send();

            if (response.hasError()) {
                log.warn("getCredential({}) eth_call returned an RPC error: {}", tokenId, response.getError().getMessage());
                return Optional.empty();
            }

            List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.size() < 6) {
                log.warn("getCredential({}) returned an unexpected number of values: {}", tokenId, decoded.size());
                return Optional.empty();
            }

            String onChainCertificateId = (String) decoded.get(0).getValue();
            String onChainCertificateHash = (String) decoded.get(1).getValue();
            String onChainStudentWallet = (String) decoded.get(2).getValue();
            Boolean onChainRevoked = (Boolean) decoded.get(4).getValue();

            return Optional.of(new OnChainCredential(
                    onChainCertificateId,
                    onChainCertificateHash,
                    onChainStudentWallet == null ? "" : onChainStudentWallet.toLowerCase(),
                    Boolean.TRUE.equals(onChainRevoked)));
        } catch (Exception e) {
            log.warn("Failed to read credential {} from the blockchain: {}", tokenId, e.getMessage());
            return Optional.empty();
        }
    }

    private TransactionReceipt fetchReceipt(String transactionHash) {
        try {
            Optional<TransactionReceipt> receipt = web3j.ethGetTransactionReceipt(transactionHash)
                    .send()
                    .getTransactionReceipt();
            return receipt.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No transaction receipt found yet for that hash — it may still be pending. Please wait a moment and try again."));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not reach the blockchain RPC to verify the transaction: " + e.getMessage());
        }
    }
}
