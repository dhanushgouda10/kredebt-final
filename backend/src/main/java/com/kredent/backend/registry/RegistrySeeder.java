package com.kredent.backend.registry;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;

/**
 * First-start data for the simulated registry: the registry administrator and a handful of sample
 * colleges covering every status, so the whole flow can be demonstrated immediately.
 *
 * Sample colleges are clearly fictional. Their HOI emails use the reserved ".example" domain unless
 * REGISTRY_DEMO_HOI_EMAIL is set — then each gets a plus-address of that mailbox (name+demo1001@...),
 * so the OTP emails land in an inbox you control while testing.
 */
@Component
public class RegistrySeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(RegistrySeeder.class);

    /** Password of every seeded sample college. Public on purpose — the registry is a demo. */
    static final String SAMPLE_COLLEGE_PASSWORD = "Demo@12345";

    private record Sample(String id, String name, String state, String district, String hoi,
                          RegistryStatus status, boolean emailVerified, String slug) {
    }

    private static final Sample[] SAMPLES = {
            new Sample("DEMO-1001", "Greenfield Institute of Technology", "Karnataka", "Bengaluru Urban",
                    "Dr. Meera Nair", RegistryStatus.APPROVED, true, "greenfield"),
            new Sample("DEMO-1002", "Riverbend College of Engineering", "Maharashtra", "Pune",
                    "Dr. Arvind Kulkarni", RegistryStatus.APPROVED, true, "riverbend"),
            new Sample("DEMO-1003", "Lakeside University of Applied Sciences", "Tamil Nadu", "Chennai",
                    "Dr. S. Lakshmi", RegistryStatus.APPROVED, true, "lakeside"),
            new Sample("DEMO-2001", "Hilltop Institute of Management", "Kerala", "Ernakulam",
                    "Dr. Thomas Mathew", RegistryStatus.PENDING, false, "hilltop"),
            new Sample("DEMO-3001", "Summit Engineering College", "Telangana", "Hyderabad",
                    "Dr. K. Ramesh", RegistryStatus.SUSPENDED, true, "summit"),
    };

    private static final String PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    private final RegistryRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final boolean seedSamples;
    private final String adminEmail;
    private final String adminPassword;
    private final String demoHoiEmail;

    public RegistrySeeder(
            RegistryRepository repository,
            PasswordEncoder passwordEncoder,
            @Value("${registry.seed-sample-data:true}") boolean seedSamples,
            @Value("${registry.admin.email:registry.admin@kredent.local}") String adminEmail,
            @Value("${registry.admin.password:}") String adminPassword,
            @Value("${registry.demo-hoi-email:}") String demoHoiEmail) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.seedSamples = seedSamples;
        this.adminEmail = adminEmail.trim().toLowerCase(Locale.ROOT);
        this.adminPassword = adminPassword;
        this.demoHoiEmail = demoHoiEmail == null ? "" : demoHoiEmail.trim();
    }

    @Override
    public void run(String... args) {
        seedAdmin();
        if (seedSamples && repository.count() == 0) {
            seedSampleColleges();
        }
    }

    private void seedAdmin() {
        if (repository.countAdmins() > 0) {
            // An explicitly configured REGISTRY_ADMIN_PASSWORD wins over whatever was generated earlier,
            // so a forgotten generated password can be replaced by setting it and restarting.
            if (adminPassword != null && !adminPassword.isBlank()) {
                repository.findAdminByEmail(adminEmail).ifPresent(admin -> {
                    if (!passwordEncoder.matches(adminPassword, admin.passwordHash())) {
                        repository.updateAdminPassword(admin.id(), passwordEncoder.encode(adminPassword));
                        log.info("Registry administrator password updated for {}", adminEmail);
                    }
                });
            }
            return;
        }
        boolean generated = adminPassword == null || adminPassword.isBlank();
        String password = generated ? randomPassword() : adminPassword;
        repository.insertAdmin(adminEmail, passwordEncoder.encode(password));

        if (generated) {
            // Printed once, like Spring Security's generated dev password. Set REGISTRY_ADMIN_PASSWORD
            // to choose your own; the hash (never the password) is all that is stored.
            log.warn("""

                    ================ KREDENT INSTITUTIONAL REGISTRY ================
                    Registry administrator created.
                      email:    {}
                      password: {}   (generated — shown only now; set REGISTRY_ADMIN_PASSWORD to choose your own)
                    =======================================================""", adminEmail, password);
        } else {
            log.info("Registry administrator created for {}", adminEmail);
        }
    }

    private void seedSampleColleges() {
        String hash = passwordEncoder.encode(SAMPLE_COLLEGE_PASSWORD);
        for (Sample s : SAMPLES) {
            RegistryInstitution institution = new RegistryInstitution(
                    0L, s.id(), s.name(), s.state(), s.district(), s.hoi(),
                    sampleEmail(s), "+91 98450 0" + s.id().substring(s.id().length() - 4),
                    hash, s.status(), s.emailVerified(), Instant.now());
            repository.insert(institution, s.emailVerified());
            repository.log(s.id(), "SEEDED", "Sample college, status " + s.status());
        }
        log.info("Seeded {} sample colleges into the demo registry", SAMPLES.length);
    }

    private String sampleEmail(Sample s) {
        int at = demoHoiEmail.indexOf('@');
        if (at > 0) {
            return demoHoiEmail.substring(0, at) + "+" + s.id().toLowerCase(Locale.ROOT).replace("-", "")
                    + demoHoiEmail.substring(at);
        }
        return "hoi@" + s.slug() + "-demo.example";
    }

    private static String randomPassword() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 16; i++) {
            sb.append(PASSWORD_ALPHABET.charAt(random.nextInt(PASSWORD_ALPHABET.length())));
        }
        return sb.toString();
    }
}
