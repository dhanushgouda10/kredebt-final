package com.kredent.backend.registry;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Slows password guessing against the registry administrator login: after {@link #MAX_FAILURES}
 * consecutive failures for an account the account is locked for {@link #LOCK_FOR}. In-memory (single
 * instance), which is appropriate for the demo registry.
 */
@Component
public class RegistryLoginLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration LOCK_FOR = Duration.ofMinutes(5);
    private static final int MAX_TRACKED = 5_000;

    private record State(int failures, Instant lockedUntil) {
    }

    private final Map<String, State> states = new ConcurrentHashMap<>();

    /** @return seconds the caller must wait, or 0 if an attempt is allowed. */
    public int secondsLocked(String key) {
        State state = states.get(key);
        if (state == null || state.lockedUntil() == null) {
            return 0;
        }
        long remaining = Duration.between(Instant.now(), state.lockedUntil()).getSeconds();
        if (remaining <= 0) {
            states.remove(key);
            return 0;
        }
        return (int) remaining + 1;
    }

    public void recordFailure(String key) {
        if (states.size() >= MAX_TRACKED) {
            states.clear();
        }
        states.merge(key, new State(1, null), (old, ignored) -> {
            int failures = old.failures() + 1;
            return new State(failures, failures >= MAX_FAILURES ? Instant.now().plus(LOCK_FOR) : null);
        });
    }

    public void recordSuccess(String key) {
        states.remove(key);
    }
}
