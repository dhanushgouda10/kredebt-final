package com.kredent.backend.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.regex.Pattern;

/**
 * Enforces the exact official domain, anchored at both ends.
 *
 * The anchoring matters: an unanchored pattern would accept
 * "student@mvjce.edu.in.attacker.com" (domain as a prefix) and
 * "student@notmvjce.edu.in" (domain as a suffix). Both are rejected here, as are
 * "student@sub.mvjce.edu.in" and "student@mvjce.ac.in".
 */
public class MvjceEmailValidator implements ConstraintValidator<MvjceEmail, String> {

    private static final Pattern MVJCE_EMAIL =
            Pattern.compile("^[A-Za-z0-9._%+-]+@mvjce\\.edu\\.in$", Pattern.CASE_INSENSITIVE);

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // Null/blank is @NotBlank's job to report — returning true here avoids two
        // messages for one empty field.
        if (value == null || value.isBlank()) {
            return true;
        }
        return MVJCE_EMAIL.matcher(value.trim()).matches();
    }
}
