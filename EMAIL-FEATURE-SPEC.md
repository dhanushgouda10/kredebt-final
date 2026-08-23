# Kredent — Student Email Notification Spec (for Cursor)

Paste into Cursor in the Kredent repo with a working Java 17 + Maven toolchain.
Implements the backend half of: institutional email restriction + a real welcome
email on student registration.

**The frontend half is already done and merged.** Match the contract in §0.

---

## Absolute rules

Do not change: the smart contract, contract address, Polygon config, certificate
hashing, QR generation, verification logic, Supabase Storage, JWT auth, or the
database schema. Do not modify unrelated files. Do not hardcode secrets. Do not
create a mock/fake email service.

Run `mvn -B test` after each phase. Do not proceed on a failing build.

---

## 0. What the frontend already does

`frontend/src/utils/collegeEmail.js` (32 passing tests) validates
`^[A-Za-z0-9._%+-]+@mvjce\.edu\.in$`, case-insensitive, and **submits the
normalised (trimmed + lowercased) email**. It is wired into:

- `AdminStudentsPage.onCreateSubmit` — admin creates a student
- `LoginSignupPage.handleSubmit` — public self-registration

The admin page reads an **optional `emailSent` boolean** off the
`POST /api/admin/students` response and shows a success or warning banner. If the
field is absent it shows nothing, so adding it is backwards-compatible.

Client validation is feedback only. The backend is the enforcement point.

---

## 1. Facts established by inspection — do not contradict these

- `RegisterRequest` is shared by **both** `AuthService.register` and
  `StudentService.adminCreateStudent`. One constraint on its `email` field covers
  both paths. This is intended: it closes the bypass where a student self-registers
  with Gmail.
- **No password is generated anywhere.** `adminCreateStudent` BCrypts
  `request.getPassword()` — the admin types it. There is no temporary password.
- **Never put a password in the email.** Not a generated one (none exists), and not
  the admin-chosen one (it is known to the admin and shared out-of-band; emailing
  plaintext credentials would be a security regression).
- Duplicate emails are **already enforced**: `existsByEmail` → 409, plus
  `unique = true` on the column. Add nothing.
- `Student` entity already has `email`. No schema change.

---

## 2. Domain constraint

New `validation/MvjceEmail` annotation + `MvjceEmailValidator`
(`ConstraintValidator<MvjceEmail, String>`):

```java
private static final Pattern P =
        Pattern.compile("^[A-Za-z0-9._%+-]+@mvjce\\.edu\\.in$", Pattern.CASE_INSENSITIVE);

@Override
public boolean isValid(String value, ConstraintValidatorContext ctx) {
    if (value == null) return false;                 // @NotBlank reports emptiness
    return P.matcher(value.trim()).matches();
}
```

Default message: `Please use your official MVJCE email address ending with @mvjce.edu.in.`

Apply to `RegisterRequest.email`, keeping the existing `@NotBlank` and `@Email`:

```java
@NotBlank
@Email
@MvjceEmail
private String email;
```

**Normalise before persisting.** In both `AuthService.register` and
`StudentService.adminCreateStudent`, lowercase and trim the email before the
`existsByEmail` check and before `setEmail(...)`. Otherwise `Student@mvjce.edu.in`
and `student@mvjce.edu.in` become two rows and the unique constraint won't catch it.

---

## 3. Email service

`pom.xml`: no new HTTP client needed — the project already uses `RestClient` for
Supabase. Reuse that pattern.

**`service/EmailService`** (interface):
```java
public interface EmailService {
    /** @return true if the provider accepted the message. Never throws. */
    boolean sendStudentWelcome(Student student);
}
```

**`service/ResendEmailService`** (`@Service`, implements `EmailService`):

- `POST https://api.resend.com/emails`
- `Authorization: Bearer ${EMAIL_API_KEY}`
- Body: `{ from, to, subject, html }`
- Timeouts: 5s connect, 10s read. A slow provider must never hang registration.
- Catch **everything** — `RestClientException`, timeouts, 4xx/5xx — and return
  `false`. Never let an email failure propagate into the registration transaction.
- Log at WARN on failure: student id and HTTP status only. **Never log the API key,
  the Authorization header, the full provider response body, or the email body.**

**Disabled mode:** if `EMAIL_API_KEY` is blank, log once at INFO that email
notifications are disabled and return `false` immediately without an HTTP call.
Local development must work without a key. This is *not* a mock — it is an
explicit off switch, and `emailSent:false` correctly reports that nothing was sent.

Config in `application.properties`:
```
email.api-key=${EMAIL_API_KEY:}
email.from=${EMAIL_FROM:onboarding@resend.dev}
app.frontend-base-url=${FRONTEND_BASE_URL:http://localhost:5173}
```
`app.frontend-base-url` already exists — reuse it, do not add a duplicate.

---

## 4. Email content

Subject: `Your Kredent Student Account Has Been Created`

Inline-CSS HTML (Gmail strips `<style>` blocks), single column, `max-width:600px`,
tables for layout. Brand colours: navy `#0E2A5C`, orange `#F7941D`.

Include only fields that actually exist: `fullName`, `email`, `usn`, `department`.

Body must say the account was created, that credentials were set by the college
administrator and shared separately, and link to `{frontend-base-url}/login`.

**Must NOT contain:** any password, the wallet address, the encrypted private key,
or any invented field.

Footer: `This is an automated email from Kredent. Please do not reply.`

Also send a `text` alternative — some clients and spam filters penalise HTML-only.

---

## 5. Wiring and response

In `StudentService.adminCreateStudent`, **after** `studentRepository.save(student)`
and after the audit log entry:

```java
boolean emailSent = emailService.sendStudentWelcome(student);
return StudentResponse.from(student, emailSent);
```

Add a nullable `Boolean emailSent` to `StudentResponse` and an overloaded factory.
Keep the existing single-arg `from(student)` working so other call sites
(`listStudents`, `updateStudent`) compile unchanged and simply omit the field.

**Registration must not roll back when email fails.** Do not throw. The student
exists; the email is a notification. If `adminCreateStudent` is `@Transactional`,
confirm the email call cannot mark the transaction rollback-only — safest is to
send *after* commit, or ensure the catch block swallows everything (it does).

`AuthService.register` returns `Map<String,String>` today. Send the welcome email
there too and add `"emailSent": String.valueOf(sent)` to the existing map — do not
change its shape.

---

## 6. Environment variables

```
EMAIL_API_KEY        # Resend API key. Backend only. Never a VITE_ var.
EMAIL_FROM           # Verified sender address
FRONTEND_BASE_URL    # Already exists — used for the login link
```

Add to `.gitignore` coverage checks. Never commit a real key.

---

## 7. Resend setup — read the limitation

1. Sign up at resend.com, create an API key (starts `re_`).
2. Set `EMAIL_API_KEY` as an environment variable / IntelliJ run-config value.
   Never in `application.properties` as a literal.
3. **Sender domain.** Resend only delivers from a verified domain.
   - Using the default `onboarding@resend.dev`: mail is delivered **only to the
     email address on your own Resend account**. Sending to
     `student@mvjce.edu.in` will *not* arrive. This is fine for a demo where you
     register yourself, and is the agreed approach for now.
   - To reach real students you must verify a domain you control by adding SPF and
     DKIM DNS records. `mvjce.edu.in` would require college IT to add them.
4. Free tier: ~100 emails/day, 3000/month at time of writing. Confirm current
   limits.

**Document the `onboarding@resend.dev` restriction in the README.** It is the single
most likely cause of "the email never arrived".

---

## 8. Tests

**`MvjceEmailValidatorTest`**
- accepts `student@mvjce.edu.in`, `first.last@mvjce.edu.in`, `1ms21cs001@mvjce.edu.in`
- accepts `STUDENT@MVJCE.EDU.IN` and mixed case
- rejects `abc@gmail.com`, `student@yahoo.com`, `student@outlook.com`
- rejects `student@mvjce.ac.in` (wrong TLD)
- rejects `student@mvjce.edu.in.evil.com` (domain as prefix)
- rejects `student@sub.mvjce.edu.in` and `student@notmvjce.edu.in`
- rejects null, empty, malformed
- tolerates surrounding whitespace

**`ResendEmailServiceTest`** (mock the `RestClient` — **no real API calls**)
- provider 200 → returns `true`
- provider 401/422/500 → returns `false`, does not throw
- timeout / `RestClientException` → returns `false`, does not throw
- blank API key → returns `false` and makes **zero** HTTP calls
- the rendered body contains the student's name, email, USN — and **does not
  contain** the password, wallet address, or private key
- **captured log output contains neither the API key nor the Authorization header**

**`StudentServiceEmailTest`**
- `sendStudentWelcome` is called once after a successful create
- email failure → student is still persisted, no exception, `emailSent == false`
- email success → `emailSent == true`
- duplicate email → 409 **and the email service is never called**

Use Mockito. Do not hit the network or a real database.

---

## 9. Report

Files changed (backend / config / tests), env vars **by name only**, test count and
result, the Resend sender limitation, and anything needing manual verification.

State plainly what you verified by running versus only by reading.
