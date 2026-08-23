package com.kredent.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class AdminWalletLoginRequest {

    @NotBlank
    private String walletAddress;

    /**
     * personal_sign output over the server-issued nonce. Required — a request without
     * it is rejected, which is what closes the old address-only authentication path.
     */
    @NotBlank
    private String signature;

    public String getWalletAddress() {
        return walletAddress;
    }

    public void setWalletAddress(String walletAddress) {
        this.walletAddress = walletAddress;
    }

    public String getSignature() {
        return signature;
    }

    public void setSignature(String signature) {
        this.signature = signature;
    }
}
