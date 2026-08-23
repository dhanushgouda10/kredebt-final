package com.kredent.backend.service;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class AdminNonceServiceTest {

    private static final String ADDRESS = "0xaB07a51fd2daBCceF287f0D3FFbce0a6D3297C3B";
    private static final String OTHER = "0x1111111111111111111111111111111111111111";

    private final AdminNonceService service = new AdminNonceService();

    @Test
    void issuesAChallengeContainingTheAddress() {
        String message = service.issue(ADDRESS);

        assertThat(message).isNotBlank();
        assertThat(message).containsIgnoringCase(ADDRESS.toLowerCase());
        assertThat(message).contains("Nonce:");
    }

    @Test
    void issuesADifferentNonceEveryTime() {
        String first = service.issue(ADDRESS);
        String second = service.issue(ADDRESS);

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void consumeReturnsTheIssuedChallenge() {
        String issued = service.issue(ADDRESS);

        assertThat(service.consume(ADDRESS)).contains(issued);
    }

    // The property that makes replay impossible.
    @Test
    void aNonceCanOnlyBeConsumedOnce() {
        service.issue(ADDRESS);

        Optional<String> first = service.consume(ADDRESS);
        Optional<String> second = service.consume(ADDRESS);

        assertThat(first).isPresent();
        assertThat(second).isEmpty();
    }

    @Test
    void reissuingReplacesThePreviousChallenge() {
        String first = service.issue(ADDRESS);
        String second = service.issue(ADDRESS);

        // Only the newest challenge is valid; the old one is gone.
        assertThat(service.consume(ADDRESS)).contains(second);
        assertThat(second).isNotEqualTo(first);
    }

    @Test
    void addressesAreIsolatedFromEachOther() {
        String forFirst = service.issue(ADDRESS);
        String forOther = service.issue(OTHER);

        assertThat(forFirst).isNotEqualTo(forOther);
        assertThat(service.consume(ADDRESS)).contains(forFirst);
        assertThat(service.consume(OTHER)).contains(forOther);
    }

    @Test
    void lookupIsCaseInsensitive() {
        service.issue(ADDRESS.toLowerCase());

        assertThat(service.consume(ADDRESS.toUpperCase())).isPresent();
    }

    @Test
    void consumingAnUnknownAddressYieldsNothing() {
        assertThat(service.consume(OTHER)).isEmpty();
    }

    @Test
    void consumingNullOrBlankIsSafe() {
        assertThat(service.consume(null)).isEmpty();
        assertThat(service.consume("")).isEmpty();
    }

    @Test
    void consumingReleasesTheEntry() {
        service.issue(ADDRESS);

        assertThat(service.outstanding()).isEqualTo(1);

        service.consume(ADDRESS);

        assertThat(service.outstanding()).isZero();
    }

    @Test
    void ttlIsShort() {
        // A long-lived challenge widens the replay window.
        // Five minutes is ample for a human to approve a MetaMask prompt.
        assertThat(AdminNonceService.TTL.toMinutes())
                .isLessThanOrEqualTo(10);
    }
}