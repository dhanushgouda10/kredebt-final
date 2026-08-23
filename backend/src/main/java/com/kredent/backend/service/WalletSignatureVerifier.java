package com.kredent.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Verifies EIP-191 (personal_sign) signatures produced by MetaMask.
 *
 * The wallet signs `"\x19Ethereum Signed Message:\n" + len + message`. Recovering
 * the public key from that prefixed digest and deriving its address tells us which
 * private key actually signed — which is the whole point: it proves possession,
 * whereas a bare address proves nothing (addresses are public by design).
 *
 * Never throws. Malformed input is a verification failure, not a 500.
 */
@Service
public class WalletSignatureVerifier {

    private static final Logger log = LoggerFactory.getLogger(WalletSignatureVerifier.class);

    /** 0x + r(32) + s(32) + v(1) == 2 + 130 characters. */
    private static final int SIGNATURE_HEX_LENGTH = 132;

    private static final Pattern ADDRESS = Pattern.compile("^0x[a-fA-F0-9]{40}$");
    private static final Pattern SIGNATURE = Pattern.compile("^0x[a-fA-F0-9]{130}$");

    public static boolean isValidAddressFormat(String address) {
        return address != null && ADDRESS.matcher(address.trim()).matches();
    }

    /**
     * @return true only if {@code signature} over {@code message} recovers to
     *         {@code expectedAddress}. False for any malformed input.
     */
    public boolean verifies(String message, String signature, String expectedAddress) {
        if (message == null || message.isBlank()
                || signature == null || expectedAddress == null
                || !isValidAddressFormat(expectedAddress)) {
            return false;
        }

        String sig = signature.trim();
        if (sig.length() != SIGNATURE_HEX_LENGTH || !SIGNATURE.matcher(sig).matches()) {
            return false;
        }

        try {
            byte[] bytes = Numeric.hexStringToByteArray(sig);
            if (bytes.length != 65) {
                return false;
            }

            byte v = bytes[64];
            // Wallets differ: some emit the recovery id as 0/1, others as 27/28.
            if (v < 27) {
                v += 27;
            }

            Sign.SignatureData data = new Sign.SignatureData(
                    v,
                    Arrays.copyOfRange(bytes, 0, 32),
                    Arrays.copyOfRange(bytes, 32, 64));

            BigInteger publicKey = Sign.signedPrefixedMessageToKey(
                    message.getBytes(StandardCharsets.UTF_8), data);

            String recovered = "0x" + Keys.getAddress(publicKey);
            return recovered.toLowerCase(Locale.ROOT)
                    .equals(expectedAddress.trim().toLowerCase(Locale.ROOT));

        } catch (Exception e) {
            // Deliberately coarse: any parsing/recovery problem is simply "did not verify".
            // Log the exception type only — never the signature or the recovered address.
            log.debug("Signature verification failed ({})", e.getClass().getSimpleName());
            return false;
        }
    }
}
