package com.kredent.backend.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * One-time login challenges for admin wallet authentication.
 *
 * The admin proves control of their wallet by signing a server-issued nonce with
 * MetaMask. For that to be meaningful the nonce must be unpredictable, short-lived
 * and usable exactly once — otherwise a captured signature could simply be replayed.
 *
 * SINGLE-INSTANCE LIMITATION: nonces live in this JVM's heap. If the application is
 * ever scaled to more than one instance behind a load balancer, a nonce issued by
 * instance A will not be found by instance B and login will fail intermittently.
 * A shared store (Redis, or a short-lived DB table) would be required at that point.
 * Deliberately not introduced here — it is infrastructure this deployment does not
 * otherwise need.
 */
@Service
public class AdminNonceService {

    /** Long enough that guessing is hopeless; short enough to read in the MetaMask popup. */
    private static final int NONCE_BYTES = 32;

    static final Duration TTL = Duration.ofMinutes(5);

    /**
     * Upper bound on tracked challenges. Without it, an unauthenticated caller could
     * request unlimited nonces and exhaust the heap, since the endpoint is public.
     */
    private static final int MAX_ENTRIES = 10_000;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, Entry> nonces = new ConcurrentHashMap<>();

    private record Entry(String message, Instant expiresAt) {
        boolean isExpired(Instant now) {
            return now.isAfter(expiresAt);
        }
    }

    /**
     * Issues a fresh challenge for the given address, replacing any previous one.
     *
     * Callers must issue a challenge for ANY well-formed address, including addresses
     * that are not admins — otherwise this endpoint becomes an oracle for discovering
     * which wallets hold admin rights.
     *
     * @return the exact text the wallet must sign
     */
    public String issue(String walletAddress) {
        Instant now = Instant.now();
        purgeExpired(now);

        // purgeExpired above has already removed what it can. If the map is still at
        // capacity the only remaining entries are live ones, which means we are being
        // flooded — drop them all rather than grow without bound. A legitimate login
        // in flight simply retries.
        if (nonces.size() >= MAX_ENTRIES) {
            nonces.clear();
        }

        byte[] random = new byte[NONCE_BYTES];
        secureRandom.nextBytes(random);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);

        // Human-readable on purpose. MetaMask shows this text verbatim; an opaque blob
        // trains administrators to approve signature prompts without reading them.
        String message = """
                Sign in to Kredent as a college administrator.

                This signature proves you control this wallet. It does not authorise \
                any blockchain transaction and costs no gas.

                Wallet: %s
                Nonce: %s
                Issued: %s"""
                .formatted(normalize(walletAddress), token, now.toString());

        nonces.put(normalize(walletAddress), new Entry(message, now.plus(TTL)));
        return message;
    }

    /**
     * Atomically retrieves and removes the challenge for an address.
     *
     * Removal is what makes a nonce single-use: ConcurrentHashMap.remove returns the
     * value to exactly one caller, so two concurrent logins with the same nonce cannot
     * both succeed.
     *
     * @return the challenge text, or empty if none exists or it has expired
     */
    public Optional<String> consume(String walletAddress) {
        if (walletAddress == null || walletAddress.isBlank()) {
            return Optional.empty();
        }
        Entry entry = nonces.remove(normalize(walletAddress));
        if (entry == null || entry.isExpired(Instant.now())) {
            return Optional.empty();
        }
        return Optional.of(entry.message());
    }

    private void purgeExpired(Instant now) {
        nonces.entrySet().removeIf(e -> e.getValue().isExpired(now));
    }

    private static String normalize(String walletAddress) {
        return walletAddress == null ? "" : walletAddress.trim().toLowerCase(java.util.Locale.ROOT);
    }

    /** Test seam — current number of outstanding challenges. */
    int outstanding() {
        return nonces.size();
    }
}
