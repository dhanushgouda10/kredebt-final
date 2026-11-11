package com.kredent.backend.service;

import com.kredent.backend.exception.ApiException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;
import java.time.Duration;

/**
 * Sends one-time passcodes by email through Gmail SMTP (Spring Boot JavaMailSender).
 *
 * Credentials come exclusively from spring.mail.* / app.mail.* (environment variables) — nothing is
 * hardcoded here and nothing reaches the frontend. The OTP is only ever interpolated into the
 * outgoing message: it is never logged, never returned to a caller and never put in an exception
 * message.
 */
@Service
public class OtpMailService {

    private static final Logger log = LoggerFactory.getLogger(OtpMailService.class);

    public static final String ADMIN_VERIFICATION_SUBJECT = "Kredent – College Administrator Verification";
    public static final String REGISTRY_VERIFICATION_SUBJECT = "Kredent Institutional Registry – Verify your institution email";

    private final JavaMailSender mailSender;
    private final String smtpUsername;
    private final String smtpPassword;
    private final String fromAddress;
    private final String fromName;

    public OtpMailService(
            JavaMailSender mailSender,
            @Value("${spring.mail.username:}") String smtpUsername,
            @Value("${spring.mail.password:}") String smtpPassword,
            @Value("${app.mail.from:}") String fromAddress,
            @Value("${app.mail.from-name:Kredent}") String fromName) {
        this.mailSender = mailSender;
        this.smtpUsername = smtpUsername;
        this.smtpPassword = smtpPassword;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
    }

    /** The "College Administrator Verification" email sent to the registered HOI address. */
    public void sendCollegeAdminOtp(String toEmail, String collegeName, String otp, Duration validFor) {
        long minutes = Math.max(1, validFor.toMinutes());
        send(toEmail, ADMIN_VERIFICATION_SUBJECT,
                renderHtml("College Administrator Verification",
                        "Use the code below to verify <strong>%s</strong> as a Kredent institution.",
                        collegeName, otp, minutes),
                renderText("College Administrator Verification", collegeName, otp, minutes));
    }

    /** Email-ownership check for the simulated registry (before an administrator may approve a college). */
    public void sendRegistryEmailOtp(String toEmail, String collegeName, String otp, Duration validFor) {
        long minutes = Math.max(1, validFor.toMinutes());
        send(toEmail, REGISTRY_VERIFICATION_SUBJECT,
                renderHtml("Verify your institution email",
                        "Use the code below to confirm the official email address registered for <strong>%s</strong> "
                                + "in the Kredent institutional registry.",
                        collegeName, otp, minutes),
                renderText("Verify your institution email", collegeName, otp, minutes));
    }

    private void send(String to, String subject, String html, String text) {
        if (smtpUsername.isBlank() || smtpPassword.isBlank() || fromAddress.isBlank()) {
            // Same outcome whether the operator forgot MAIL_PASSWORD or MAIL_USERNAME: say so plainly,
            // never pretend a message was sent, and never echo which value is missing or any value at all.
            log.warn("OTP email not sent: SMTP is not configured (set MAIL_USERNAME, MAIL_PASSWORD and MAIL_FROM).");
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "EMAIL_NOT_CONFIGURED",
                    "Email delivery is not configured on this server yet. Please contact the platform administrator.");
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(new InternetAddress(fromAddress, fromName, "UTF-8"));
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, html);
            mailSender.send(message);
        } catch (MailAuthenticationException e) {
            log.error("OTP email failed: SMTP rejected the credentials. Check MAIL_USERNAME and that MAIL_PASSWORD "
                    + "is a Gmail App Password.");
            throw sendFailed();
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            // Class name only: some provider messages embed the recipient or server details.
            log.warn("OTP email could not be sent ({})", e.getClass().getSimpleName());
            throw sendFailed();
        }
    }

    private static ApiException sendFailed() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "EMAIL_SEND_FAILED",
                "We could not send the verification email. Please try again in a moment.");
    }

    // ------------------------------------------------------------------ templates

    /**
     * Inline CSS and table layout only — Gmail and Outlook strip style blocks. The college name is
     * HTML-escaped because it originates from a registration form.
     */
    static String renderHtml(String heading, String introTemplate, String collegeName, String otp, long minutes) {
        String college = escape(collegeName);
        String intro = introTemplate.formatted(college);
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Helvetica,Arial,sans-serif;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">
                    <tr><td align="center">
                      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">

                        <tr><td style="background-color:#1e1b4b;padding:26px 32px;">
                          <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:3px;">KREDENT</div>
                          <div style="color:#99f6e4;font-size:13px;margin-top:4px;">Trusted Academic Credentials. Verified on Blockchain.</div>
                        </td></tr>

                        <tr><td style="padding:32px;">
                          <h1 style="margin:0 0 16px;font-size:20px;color:#312e81;">%s</h1>
                          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#0f172a;">%s</p>
                          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#0f172a;">Institution: <strong>%s</strong></p>

                          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;margin:0 0 22px;">
                            <tr><td align="center" style="padding:22px 12px;">
                              <div style="font-size:12px;letter-spacing:2px;color:#475569;text-transform:uppercase;margin-bottom:8px;">Your verification code</div>
                              <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:bold;letter-spacing:10px;color:#312e81;">%s</div>
                            </td></tr>
                          </table>

                          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#0f172a;">
                            This code expires in <strong>%d minutes</strong> and can be used only once.
                          </p>

                          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                            <tr><td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#991b1b;">
                              <strong>Security warning:</strong> never share this code with anyone. Kredent staff will never
                              ask for it. If you did not request this verification, ignore this email &mdash; no action is needed.
                            </td></tr>
                          </table>
                        </td></tr>

                        <tr><td style="background-color:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
                          <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                            This is an automated message from Kredent. Please do not reply.
                          </p>
                        </td></tr>

                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(escape(heading), intro, college, escape(otp), minutes);
    }

    static String renderText(String heading, String collegeName, String otp, long minutes) {
        return """
                KREDENT
                Trusted Academic Credentials. Verified on Blockchain.

                %s

                Institution: %s

                Your verification code: %s

                This code expires in %d minutes and can be used only once.

                SECURITY WARNING: never share this code with anyone. Kredent staff will never ask
                for it. If you did not request this verification, ignore this email.

                This is an automated message from Kredent. Please do not reply.
                """.formatted(heading, collegeName == null ? "" : collegeName, otp, minutes);
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
