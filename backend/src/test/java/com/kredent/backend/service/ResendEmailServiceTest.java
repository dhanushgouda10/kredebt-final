package com.kredent.backend.service;

import com.kredent.backend.entity.Student;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * No real provider calls. Failure paths are exercised by pointing the service at an
 * unreachable local port, which fails fast with connection-refused.
 */
class ResendEmailServiceTest {

    /** Nothing listens here, so any request fails immediately. */
    private static final String UNREACHABLE = "http://127.0.0.1:1/emails";

    private static Student student() {
        Student s = new Student();
        s.setId(42L);
        s.setFullName("Asha Rao");
        s.setUsn("1MJ21CS001");
        s.setEmail("asha.rao@mvjce.edu.in");
        s.setDepartment("CSE");
        s.setPassword("$2a$10$hashed-password-value-should-never-be-emailed");
        s.setWalletAddress("0xaB07a51fd2daBCceF287f0D3FFbce0a6D3297C3B");
        s.setWalletPrivateKeyEncrypted("ENCRYPTED-KEY-MUST-NEVER-APPEAR");
        s.setCreatedAt(LocalDateTime.of(2026, 8, 20, 10, 0));
        return s;
    }

    private static ResendEmailService service(String apiKey, String endpoint) {
        return new ResendEmailService(
                RestClient.builder(), apiKey, "onboarding@resend.dev",
                "http://localhost:5173", endpoint);
    }

    @Test
    void blankApiKeyDisablesSendingWithoutAnyHttpCall() {
        // Endpoint is unreachable — if an HTTP call were attempted this would still
        // return false, so the meaningful assertion is that it returns immediately
        // and never throws.
        ResendEmailService svc = service("", UNREACHABLE);
        assertThat(svc.sendStudentWelcome(student())).isFalse();
    }

    @Test
    void nullApiKeyIsTreatedAsDisabled() {
        assertThat(service(null, UNREACHABLE).sendStudentWelcome(student())).isFalse();
    }

    @Test
    void providerFailureReturnsFalseAndNeverThrows() {
        ResendEmailService svc = service("re_test_key", UNREACHABLE);

        assertThatCode(() -> svc.sendStudentWelcome(student())).doesNotThrowAnyException();
        assertThat(svc.sendStudentWelcome(student())).isFalse();
    }

    @Test
    void missingOrBlankRecipientIsRejected() {
        ResendEmailService svc = service("re_test_key", UNREACHABLE);

        Student noEmail = student();
        noEmail.setEmail(null);
        assertThat(svc.sendStudentWelcome(noEmail)).isFalse();

        Student blankEmail = student();
        blankEmail.setEmail("   ");
        assertThat(svc.sendStudentWelcome(blankEmail)).isFalse();
    }

    @Test
    void nullStudentIsHandled() {
        assertThat(service("re_test_key", UNREACHABLE).sendStudentWelcome(null)).isFalse();
    }

    @Test
    void htmlContainsTheStudentDetails() {
        String html = service("k", UNREACHABLE).renderHtml(student());

        assertThat(html).contains("Asha Rao");
        assertThat(html).contains("1MJ21CS001");
        assertThat(html).contains("asha.rao@mvjce.edu.in");
        assertThat(html).contains("CSE");
        assertThat(html).contains("http://localhost:5173/login");
    }

    // The security-critical assertion: no credentials or key material in the message.
    @Test
    void htmlLeaksNoSecrets() {
        String html = service("re_super_secret_key", UNREACHABLE).renderHtml(student());

        assertThat(html).doesNotContain("$2a$10$");
        assertThat(html).doesNotContain("hashed-password-value");
        assertThat(html).doesNotContain("ENCRYPTED-KEY-MUST-NEVER-APPEAR");
        assertThat(html).doesNotContain("0xaB07a51fd2daBCceF287f0D3FFbce0a6D3297C3B");
        assertThat(html).doesNotContain("re_super_secret_key");
    }

    @Test
    void plainTextAlternativeLeaksNoSecretsEither() {
        String text = service("re_super_secret_key", UNREACHABLE).renderText(student());

        assertThat(text).contains("Asha Rao");
        assertThat(text).doesNotContain("$2a$10$");
        assertThat(text).doesNotContain("ENCRYPTED-KEY-MUST-NEVER-APPEAR");
        assertThat(text).doesNotContain("re_super_secret_key");
    }

    @Test
    void includesTheDoNotReplyNotice() {
        assertThat(service("k", UNREACHABLE).renderHtml(student()))
                .contains("automated email from Kredent");
        assertThat(service("k", UNREACHABLE).renderText(student()))
                .contains("automated email from Kredent");
    }

    @Test
    void studentSuppliedValuesAreHtmlEscaped() {
        Student s = student();
        s.setFullName("<script>alert('xss')</script>");

        String html = service("k", UNREACHABLE).renderHtml(s);

        assertThat(html).doesNotContain("<script>");
        assertThat(html).contains("&lt;script&gt;");
    }

    @Test
    void trailingSlashOnBaseUrlDoesNotProduceADoubleSlashLink() {
        ResendEmailService svc = new ResendEmailService(
                RestClient.builder(), "k", "onboarding@resend.dev",
                "http://localhost:5173/", UNREACHABLE);

        assertThat(svc.renderHtml(student())).contains("http://localhost:5173/login");
        assertThat(svc.renderHtml(student())).doesNotContain("5173//login");
    }
}
