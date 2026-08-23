package com.kredent.backend.service;

import org.junit.jupiter.api.Test;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises real secp256k1 signing rather than a mock — the whole value of this
 * class is that the cryptography is correct, which a stub could not demonstrate.
 */
class WalletSignatureVerifierTest {

    private final WalletSignatureVerifier verifier = new WalletSignatureVerifier();

    private static final String MESSAGE = "Sign in to Kredent.\n\nNonce: abc123";

    private record Wallet(String address, ECKeyPair keyPair) {}

    private static Wallet newWallet() throws Exception {
        ECKeyPair keyPair = Keys.createEcKeyPair();
        return new Wallet("0x" + Keys.getAddress(keyPair), keyPair);
    }

    /** Mirrors what MetaMask's personal_sign produces: EIP-191 prefixed, 65 bytes hex. */
    private static String sign(String message, ECKeyPair keyPair) {
        Sign.SignatureData sig =
                Sign.signPrefixedMessage(message.getBytes(StandardCharsets.UTF_8), keyPair);
        byte[] out = new byte[65];
        System.arraycopy(sig.getR(), 0, out, 0, 32);
        System.arraycopy(sig.getS(), 0, out, 32, 32);
        out[64] = sig.getV()[0];
        return Numeric.toHexString(out);
    }

    @Test
    void acceptsAGenuineSignatureFromTheClaimedWallet() throws Exception {
        Wallet wallet = newWallet();
        String signature = sign(MESSAGE, wallet.keyPair());

        assertThat(verifier.verifies(MESSAGE, signature, wallet.address())).isTrue();
    }

    @Test
    void addressComparisonIsCaseInsensitive() throws Exception {
        Wallet wallet = newWallet();
        String signature = sign(MESSAGE, wallet.keyPair());

        assertThat(verifier.verifies(MESSAGE, signature, wallet.address().toUpperCase()
                .replace("0X", "0x"))).isTrue();
    }

    // The core attack: signing with your own key while claiming to be someone else.
    @Test
    void rejectsASignatureFromADifferentWallet() throws Exception {
        Wallet victim = newWallet();
        Wallet attacker = newWallet();
        String attackerSignature = sign(MESSAGE, attacker.keyPair());

        assertThat(verifier.verifies(MESSAGE, attackerSignature, victim.address())).isFalse();
    }

    // Replay defence at the crypto layer: a signature is bound to its exact message.
    @Test
    void rejectsAValidSignatureOverADifferentMessage() throws Exception {
        Wallet wallet = newWallet();
        String signature = sign("Nonce: THE-OLD-ONE", wallet.keyPair());

        assertThat(verifier.verifies("Nonce: THE-NEW-ONE", signature, wallet.address())).isFalse();
    }

    @Test
    void rejectsATamperedSignature() throws Exception {
        Wallet wallet = newWallet();
        String signature = sign(MESSAGE, wallet.keyPair());
        // Flip one hex character in the r component.
        char at = signature.charAt(10);
        String tampered = signature.substring(0, 10)
                + (at == 'a' ? 'b' : 'a')
                + signature.substring(11);

        assertThat(verifier.verifies(MESSAGE, tampered, wallet.address())).isFalse();
    }

    @Test
    void rejectsMalformedSignaturesWithoutThrowing() throws Exception {
        Wallet wallet = newWallet();

        assertThat(verifier.verifies(MESSAGE, null, wallet.address())).isFalse();
        assertThat(verifier.verifies(MESSAGE, "", wallet.address())).isFalse();
        assertThat(verifier.verifies(MESSAGE, "0xdeadbeef", wallet.address())).isFalse();
        assertThat(verifier.verifies(MESSAGE, "not-hex-at-all", wallet.address())).isFalse();
        // Correct length but missing the 0x prefix.
        assertThat(verifier.verifies(MESSAGE, "a".repeat(132), wallet.address())).isFalse();
    }

    @Test
    void rejectsMalformedAddresses() throws Exception {
        Wallet wallet = newWallet();
        String signature = sign(MESSAGE, wallet.keyPair());

        assertThat(verifier.verifies(MESSAGE, signature, null)).isFalse();
        assertThat(verifier.verifies(MESSAGE, signature, "0x123")).isFalse();
        assertThat(verifier.verifies(MESSAGE, signature, "not-an-address")).isFalse();
    }

    @Test
    void rejectsABlankMessage() throws Exception {
        Wallet wallet = newWallet();
        String signature = sign(MESSAGE, wallet.keyPair());

        assertThat(verifier.verifies(null, signature, wallet.address())).isFalse();
        assertThat(verifier.verifies("", signature, wallet.address())).isFalse();
    }

    @Test
    void addressFormatCheckIsStrict() {
        assertThat(WalletSignatureVerifier.isValidAddressFormat(
                "0xaB07a51fd2daBCceF287f0D3FFbce0a6D3297C3B")).isTrue();
        assertThat(WalletSignatureVerifier.isValidAddressFormat("0x123")).isFalse();
        assertThat(WalletSignatureVerifier.isValidAddressFormat(
                "aB07a51fd2daBCceF287f0D3FFbce0a6D3297C3B")).isFalse();
        assertThat(WalletSignatureVerifier.isValidAddressFormat(null)).isFalse();
    }
}
