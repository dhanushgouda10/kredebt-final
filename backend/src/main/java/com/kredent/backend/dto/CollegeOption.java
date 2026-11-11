package com.kredent.backend.dto;

/**
 * One college in the public picker shown on the registration and sign-in screens. Deliberately
 * carries no contact details — only what a person needs to recognise their institution.
 *
 * @param joinedKredent true once the institution has completed Kredent verification and can issue
 *                      certificates; students can only register at institutions that have joined.
 */
public record CollegeOption(
        String institutionId,
        String name,
        String state,
        String district,
        boolean joinedKredent) {
}
