package com.kredent.backend.validation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class MvjceEmailValidatorTest {

    private final MvjceEmailValidator validator = new MvjceEmailValidator();

    private boolean valid(String email) {
        return validator.isValid(email, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "student@mvjce.edu.in",
            "first.last@mvjce.edu.in",
            "1ms21cs001@mvjce.edu.in",
            "name_with_underscore@mvjce.edu.in",
            "name-with-dash@mvjce.edu.in",
            "name+tag@mvjce.edu.in",
            "a%b@mvjce.edu.in",
    })
    void acceptsOfficialCollegeAddresses(String email) {
        assertThat(valid(email)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "STUDENT@MVJCE.EDU.IN",
            "Student@Mvjce.Edu.In",
            "student@MVJCE.edu.in",
    })
    void isCaseInsensitive(String email) {
        assertThat(valid(email)).isTrue();
    }

    @Test
    void toleratesSurroundingWhitespaceFromCopyPaste() {
        assertThat(valid("  student@mvjce.edu.in  ")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "abc@gmail.com",
            "student@yahoo.com",
            "student@outlook.com",
            "student@hotmail.com",
    })
    void rejectsPersonalEmailProviders(String email) {
        assertThat(valid(email)).isFalse();
    }

    @Test
    void rejectsTheWrongCollegeTld() {
        // mvjce.ac.in is a different domain from mvjce.edu.in.
        assertThat(valid("student@mvjce.ac.in")).isFalse();
        assertThat(valid("student@mvjce.edu")).isFalse();
    }

    @Test
    void rejectsTheDomainUsedAsAPrefixOfAnAttackerDomain() {
        // The classic unanchored-regex hole.
        assertThat(valid("student@mvjce.edu.in.attacker.com")).isFalse();
    }

    @Test
    void rejectsTheDomainUsedAsASuffix() {
        assertThat(valid("student@notmvjce.edu.in")).isFalse();
        assertThat(valid("student@evilmvjce.edu.in")).isFalse();
    }

    @Test
    void rejectsSubdomains() {
        assertThat(valid("student@sub.mvjce.edu.in")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "student",
            "student@",
            "@mvjce.edu.in",
            "student mvjce.edu.in",
            "student@@mvjce.edu.in",
    })
    void rejectsMalformedAddresses(String email) {
        assertThat(valid(email)).isFalse();
    }

    @Test
    void defersEmptinessToNotBlank() {
        // Returning true for null/blank avoids two error messages on one empty field;
        // @NotBlank on the same property reports it.
        assertThat(valid(null)).isTrue();
        assertThat(valid("")).isTrue();
        assertThat(valid("   ")).isTrue();
    }
}
