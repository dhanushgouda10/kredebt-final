package com.kredent.backend.service;

import com.kredent.backend.entity.Student;

/**
 * Transactional email for student notifications.
 *
 * Implementations must never throw: a notification failure is not a reason to fail
 * or roll back an account creation that has already succeeded. Callers use the
 * boolean to tell the operator whether a manual follow-up is needed.
 */
public interface EmailService {

    /**
     * Sends the "your Kredent account has been created" message.
     *
     * @return true only if the provider accepted the message for delivery. Never throws.
     */
    boolean sendStudentWelcome(Student student);
}
