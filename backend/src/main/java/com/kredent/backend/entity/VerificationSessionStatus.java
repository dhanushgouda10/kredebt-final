package com.kredent.backend.entity;

/** Lifecycle of one college-administrator verification attempt. */
public enum VerificationSessionStatus {
    /** OTP emailed, waiting for the administrator to enter it. */
    OTP_SENT,
    /** OTP accepted; the wallet step may now be completed. */
    VERIFIED,
    /** Wallet linked and the institution registered — the session can never be used again. */
    COMPLETED,
    /** Superseded by a newer OTP, or the OTP was consumed by too many failed attempts. */
    INVALIDATED
}
