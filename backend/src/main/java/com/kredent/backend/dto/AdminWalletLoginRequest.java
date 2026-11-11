package com.kredent.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class AdminWalletLoginRequest {

    /**
     * The institutional ID (Demo AICTE PID) the administrator is signing in for. Required because
     * several institutions may share one wallet in this deployment, so the wallet alone cannot say
     * which institution's dashboard to open.
     */
    @NotBlank
    private String institutionId;

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

    public String getInstitutionId() {
        return institutionId;
    }

    public void setInstitutionId(String institutionId) {
        this.institutionId = institutionId;
    }
}
