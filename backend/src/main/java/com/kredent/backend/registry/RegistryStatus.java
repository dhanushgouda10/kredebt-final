package com.kredent.backend.registry;

/** Lifecycle of an institution in the simulated registry. Only APPROVED institutions can use Kredent. */
public enum RegistryStatus {
    PENDING,
    APPROVED,
    SUSPENDED
}
