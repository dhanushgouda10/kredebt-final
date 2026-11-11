package com.kredent.backend.util;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class OtpUtilTest {

    @Test
    void generatedOtpsAreSixDigitsAndVary() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            String otp = OtpUtil.generateOtp();
            assertThat(otp).matches("^[0-9]{6}$");
            seen.add(otp);
        }
        assertThat(seen.size()).isGreaterThan(150);
    }

    @Test
    void correctOtpMatchesAndWrongOtpDoesNot() {
        String salt = OtpUtil.newSalt();
        String hash = OtpUtil.hash("123456", salt, "ctx", "secret");

        assertThat(OtpUtil.matches("123456", salt, "ctx", "secret", hash)).isTrue();
        assertThat(OtpUtil.matches("123457", salt, "ctx", "secret", hash)).isFalse();
        assertThat(OtpUtil.matches(null, salt, "ctx", "secret", hash)).isFalse();
    }

    @Test
    void hashIsBoundToContextSaltAndSecret() {
        String salt = OtpUtil.newSalt();
        String hash = OtpUtil.hash("123456", salt, "institution-A:session-1", "secret");

        // A hash issued for one institution/session cannot be replayed against another.
        assertThat(OtpUtil.matches("123456", salt, "institution-B:session-1", "secret", hash)).isFalse();
        assertThat(OtpUtil.matches("123456", OtpUtil.newSalt(), "institution-A:session-1", "secret", hash)).isFalse();
        assertThat(OtpUtil.matches("123456", salt, "institution-A:session-1", "other-secret", hash)).isFalse();
    }

    @Test
    void storedHashNeverContainsTheOtp() {
        String hash = OtpUtil.hash("123456", OtpUtil.newSalt(), "ctx", "secret");
        assertThat(hash).doesNotContain("123456").hasSize(64);
    }

    @Test
    void emailIsMasked() {
        assertThat(OtpUtil.maskEmail("hoi@greenfield.edu")).isEqualTo("h**@greenfield.edu");
        assertThat(OtpUtil.maskEmail("a@x.org")).isEqualTo("*@x.org");
        assertThat(OtpUtil.maskEmail("not-an-email")).isEmpty();
        assertThat(OtpUtil.maskEmail("a.very.long.name@x.org")).startsWith("a******@");
    }
}
