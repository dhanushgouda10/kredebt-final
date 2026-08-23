package com.kredent.backend.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Restricts a student email to the official MVJCE domain.
 *
 * Applied to RegisterRequest.email, which is shared by BOTH registration paths
 * (AuthService.register for public self-registration and
 * StudentService.adminCreateStudent for admin-created accounts). Constraining the
 * shared DTO means neither path can be used to slip a personal address in — if
 * only the admin route were checked, a student could self-register with Gmail and
 * bypass the rule entirely.
 *
 * The frontend performs the same check for immediate feedback
 * (frontend/src/utils/collegeEmail.js), but this annotation is the actual
 * enforcement point; client-side validation is trivially bypassed.
 */
@Documented
@Constraint(validatedBy = MvjceEmailValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface MvjceEmail {

    String message() default "Please use your official MVJCE email address ending with @mvjce.edu.in.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
