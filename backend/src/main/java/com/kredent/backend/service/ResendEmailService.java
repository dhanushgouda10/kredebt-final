package com.kredent.backend.service;

import com.kredent.backend.entity.Student;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Sends real transactional email through Resend's HTTP API.
 *
 * Design constraints, all deliberate:
 *
 *  - Never throws. Every failure path returns false. Registration has already
 *    committed by the time this runs; an SMTP hiccup must not undo a student account.
 *  - Never logs the API key, the Authorization header, the provider's response body,
 *    or the rendered message. Failures log the student id and HTTP status only.
 *  - Blank EMAIL_API_KEY disables sending entirely (no HTTP call at all) so local
 *    development works without credentials. This is an explicit off switch, not a
 *    mock — nothing is faked, and callers correctly observe emailSent == false.
 *
 * SENDER LIMITATION: Resend only delivers from a verified domain. With the default
 * onboarding@resend.dev sender, mail is delivered ONLY to the address on the Resend
 * account that owns the API key — sending to an arbitrary @mvjce.edu.in address will
 * not arrive. Verifying a real domain (SPF + DKIM DNS records) is required to reach
 * actual students.
 */
@Service
public class ResendEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(ResendEmailService.class);

    private static final String SUBJECT = "Your Kredent Student Account Has Been Created";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMMM yyyy");

    private final RestClient restClient;
    private final String endpoint;
    private final String apiKey;
    private final String fromAddress;
    private final String frontendBaseUrl;

    /** Ensures the "email disabled" notice is logged once, not on every registration. */
    private final AtomicBoolean disabledNoticeLogged = new AtomicBoolean(false);

    public ResendEmailService(
            RestClient.Builder restClientBuilder,
            @Value("${email.api-key:}") String apiKey,
            @Value("${email.from:onboarding@resend.dev}") String fromAddress,
            @Value("${app.frontend-base-url:http://localhost:5173}") String frontendBaseUrl,
            // Overridable so tests can point at an unreachable host and exercise the
            // failure path without calling the real provider.
            @Value("${email.endpoint:https://api.resend.com/emails}") String endpoint) {
        this.restClient = restClientBuilder.build();
        this.endpoint = endpoint;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.fromAddress = fromAddress;
        this.frontendBaseUrl = stripTrailingSlash(frontendBaseUrl);
    }

    @Override
    public boolean sendStudentWelcome(Student student) {
        if (student == null || student.getEmail() == null || student.getEmail().isBlank()) {
            return false;
        }

        if (apiKey.isBlank()) {
            if (disabledNoticeLogged.compareAndSet(false, true)) {
                log.info("EMAIL_API_KEY is not configured — student notification emails are disabled.");
            }
            return false;
        }

        try {
            restClient.post()
                    .uri(endpoint)
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", fromAddress,
                            "to", new String[]{student.getEmail()},
                            "subject", SUBJECT,
                            "html", renderHtml(student),
                            "text", renderText(student)))
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (org.springframework.web.client.RestClientResponseException e) {
            // Status code only — the provider body can echo request contents.
            log.warn("Welcome email rejected by provider for student id={} (HTTP {})",
                    student.getId(), e.getStatusCode().value());
            return false;
        } catch (Exception e) {
            // Timeouts, DNS failures, connection resets. Log the type, not the message,
            // since some clients embed the request URL (which carries no secret today,
            // but this keeps that guarantee independent of the client's behaviour).
            log.warn("Welcome email could not be sent for student id={} ({})",
                    student.getId(), e.getClass().getSimpleName());
            return false;
        }
    }

    /**
     * Inline CSS only — Gmail and Outlook strip &lt;style&gt; blocks. Table-based layout
     * for the same reason.
     *
     * Contains no password (none is generated by this system, and the admin-chosen
     * one must never travel by email), no wallet address, and no key material.
     */
    /* package-private for testing */ String renderHtml(Student student) {
        String issuedOn = student.getCreatedAt() == null ? "" : student.getCreatedAt().format(DATE);
        String loginUrl = frontendBaseUrl + "/login";

        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background-color:#faf7f0;font-family:Helvetica,Arial,sans-serif;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#faf7f0;padding:24px 12px;">
                    <tr><td align="center">
                      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;background-color:#fefcf7;border:1px solid #e7e0d2;border-radius:12px;overflow:hidden;">

                        <tr><td style="background-color:#0e2a5c;padding:28px 32px;">
                          <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:1px;">KREDENT</div>
                          <div style="color:#e9b949;font-size:13px;margin-top:4px;">MVJ College of Engineering</div>
                        </td></tr>

                        <tr><td style="padding:32px;">
                          <h1 style="margin:0 0 20px;font-size:20px;color:#0e2a5c;">Your student account has been created</h1>

                          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1b2a41;">Dear %s,</p>

                          <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#1b2a41;">
                            An account has been created for you on Kredent, the digital academic credential
                            platform of MVJ College of Engineering. Degree certificates issued to you by the
                            college will appear in your student portal, where you can view and download them
                            at any time.
                          </p>

                          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f3eee3;border-radius:8px;margin:0 0 24px;">
                            <tr><td style="padding:18px 20px;font-size:15px;line-height:1.7;color:#1b2a41;">
                              <strong style="color:#0e2a5c;">Name</strong><br>%s<br><br>
                              <strong style="color:#0e2a5c;">USN</strong><br>%s<br><br>
                              <strong style="color:#0e2a5c;">Department</strong><br>%s<br><br>
                              <strong style="color:#0e2a5c;">Registered email</strong><br>%s%s
                            </td></tr>
                          </table>

                          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#1b2a41;">
                            Your login credentials have been set by the college administrator and shared with
                            you separately. For your security they are not included in this email.
                          </p>

                          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
                            <tr><td style="background-color:#f7941d;border-radius:8px;">
                              <a href="%s" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Sign in to Kredent</a>
                            </td></tr>
                          </table>
                          <p style="margin:12px 0 0;font-size:13px;color:#5a6b84;word-break:break-all;">%s</p>
                        </td></tr>

                        <tr><td style="background-color:#f3eee3;padding:20px 32px;border-top:1px solid #e7e0d2;">
                          <p style="margin:0;font-size:12px;line-height:1.6;color:#5a6b84;">
                            This is an automated email from Kredent. Please do not reply.<br>
                            MVJ College of Engineering, Near ITPB, Whitefield, Bangalore-560 067
                          </p>
                        </td></tr>

                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(
                escape(student.getFullName()),
                escape(student.getFullName()),
                escape(student.getUsn()),
                escape(student.getDepartment()),
                escape(student.getEmail()),
                issuedOn.isBlank() ? "" : "<br><br><strong style=\"color:#0e2a5c;\">Account created</strong><br>" + issuedOn,
                loginUrl,
                loginUrl);
    }

    /** Plain-text alternative — HTML-only mail scores worse with spam filters. */
    /* package-private for testing */ String renderText(Student student) {
        return """
                KREDENT — MVJ College of Engineering

                Your student account has been created

                Dear %s,

                An account has been created for you on Kredent, the digital academic
                credential platform of MVJ College of Engineering. Degree certificates
                issued to you by the college will appear in your student portal.

                Name:             %s
                USN:              %s
                Department:       %s
                Registered email: %s

                Your login credentials have been set by the college administrator and
                shared with you separately. For your security they are not included in
                this email.

                Sign in: %s

                This is an automated email from Kredent. Please do not reply.
                """.formatted(
                nullSafe(student.getFullName()),
                nullSafe(student.getFullName()),
                nullSafe(student.getUsn()),
                nullSafe(student.getDepartment()),
                nullSafe(student.getEmail()),
                frontendBaseUrl + "/login");
    }

    /** Minimal HTML escaping — student-supplied values are interpolated into markup. */
    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private static String stripTrailingSlash(String url) {
        if (url == null || url.isBlank()) {
            return "";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
