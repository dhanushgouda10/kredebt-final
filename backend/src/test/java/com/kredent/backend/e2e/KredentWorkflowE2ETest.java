package com.kredent.backend.e2e;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kredent.backend.service.BlockchainVerificationService;
import com.kredent.backend.service.BlockchainVerificationService.OnChainCredential;
import com.kredent.backend.service.OtpMailService;
import com.kredent.backend.service.SupabaseStorageService;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The whole Kredent workflow against the real application (Spring context, security filters, JPA,
 * the SQLite registry) with only the three external systems stubbed: e-mail delivery, Supabase file
 * storage and the blockchain RPC. Everything the user does in the browser is an HTTP call here.
 */
@SpringBootTest(properties = {
        "DB_URL=jdbc:h2:mem:e2e;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "DB_USERNAME=sa",
        "DB_PASSWORD=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.show-sql=false",
        "registry.db-path=target/e2e-registry-${random.uuid}.db",
        "registry.admin.email=registry.admin@example.org",
        "registry.admin.password=RegistryAdmin#2026",
        "registry.seed-sample-data=true"
})
@AutoConfigureMockMvc
class KredentWorkflowE2ETest {

    @Autowired private org.springframework.test.web.servlet.MockMvc mvc;
    @Autowired private ObjectMapper json;

    @MockBean private OtpMailService mail;
    @MockBean private SupabaseStorageService storage;
    @MockBean private BlockchainVerificationService chain;

    private final List<String> otps = new ArrayList<>();

    // ------------------------------------------------------------------------------- helpers

    private JsonNode body(ResultActions a) throws Exception {
        return json.readTree(a.andReturn().getResponse().getContentAsString());
    }

    private ResultActions send(MockHttpServletRequestBuilder b, String token, Object payload) throws Exception {
        if (token != null) {
            b.header("Authorization", "Bearer " + token);
        }
        if (payload != null) {
            b.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload));
        }
        return mvc.perform(b);
    }

    private static String sign(ECKeyPair key, String message) {
        Sign.SignatureData sd = Sign.signPrefixedMessage(message.getBytes(StandardCharsets.UTF_8), key);
        byte[] sig = new byte[65];
        System.arraycopy(sd.getR(), 0, sig, 0, 32);
        System.arraycopy(sd.getS(), 0, sig, 32, 32);
        sig[64] = sd.getV()[0];
        return Numeric.toHexString(sig);
    }

    /** First-time verification of a registry college: lookup -> OTP -> wallet signature. Returns the admin JWT. */
    private String onboard(String institutionId, ECKeyPair key) throws Exception {
        String wallet = "0x" + Keys.getAddress(key.getPublicKey());
        send(post("/api/auth/institution/lookup"), null, java.util.Map.of("institutionId", institutionId))
                .andExpect(status().isOk());
        JsonNode sent = body(send(post("/api/auth/institution/otp/send"), null, java.util.Map.of("institutionId", institutionId))
                .andExpect(status().isOk()));
        assertFalse(sent.has("otp"), "the OTP must never be returned by the API");
        String otp = otps.get(otps.size() - 1);
        String sessionId = sent.get("sessionId").asText();

        send(post("/api/auth/institution/otp/verify"), null, java.util.Map.of("sessionId", sessionId, "otp", otp))
                .andExpect(status().isOk());

        String nonce = body(mvc.perform(get("/api/auth/admin/nonce").param("address", wallet))
                .andExpect(status().isOk())).get("nonce").asText();
        JsonNode auth = body(send(post("/api/auth/institution/complete"), null, java.util.Map.of(
                "sessionId", sessionId, "walletAddress", wallet, "signature", sign(key, nonce)))
                .andExpect(status().isOk()));
        assertEquals(institutionId, auth.get("institution").get("institutionId").asText());
        return auth.get("token").asText();
    }

    private String signIn(String institutionId, ECKeyPair key) throws Exception {
        String wallet = "0x" + Keys.getAddress(key.getPublicKey());
        String nonce = body(mvc.perform(get("/api/auth/admin/nonce").param("address", wallet))
                .andExpect(status().isOk())).get("nonce").asText();
        return body(send(post("/api/auth/admin/wallet-login"), null, java.util.Map.of(
                "institutionId", institutionId, "walletAddress", wallet, "signature", sign(key, nonce)))
                .andExpect(status().isOk())).get("token").asText();
    }

    private static byte[] pdf() throws Exception {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            doc.addPage(new PDPage());
            doc.save(out);
            return out.toByteArray();
        }
    }

    // ------------------------------------------------------------------------------- the test

    @Test
    void fullWorkflow() throws Exception {
        doAnswer(inv -> { otps.add(inv.getArgument(2)); return null; })
                .when(mail).sendCollegeAdminOtp(anyString(), anyString(), anyString(), any(Duration.class));
        doAnswer(inv -> { otps.add(inv.getArgument(2)); return null; })
                .when(mail).sendRegistryEmailOtp(anyString(), anyString(), anyString(), any(Duration.class));
        AtomicReference<byte[]> storedPdf = new AtomicReference<>();
        when(storage.upload(anyString(), any(byte[].class), anyString())).thenAnswer(inv -> {
            storedPdf.set(inv.getArgument(1));
            return "https://storage.example/certificate.pdf";
        });
        when(chain.contractAddress()).thenReturn("0xcontractcontractcontractcontractcontract00");

        // ---- 1. the public college picker lists approved registry colleges only --------------------
        JsonNode colleges = body(mvc.perform(get("/api/auth/institution/list")).andExpect(status().isOk()));
        List<String> ids = new ArrayList<>();
        colleges.forEach(c -> ids.add(c.get("institutionId").asText()));
        assertTrue(ids.contains("DEMO-1001") && ids.contains("DEMO-1002"), "approved colleges are listed: " + ids);
        assertFalse(ids.contains("DEMO-2001"), "a PENDING college must not be listed");
        assertFalse(ids.contains("DEMO-3001"), "a SUSPENDED college must not be listed");
        assertFalse(colleges.toString().contains("@"), "no e-mail address may appear in the public list");
        colleges.forEach(c -> assertFalse(c.get("joinedKredent").asBoolean()));

        // ---- 2. a student cannot register at a college that has not joined Kredent ----------------
        java.util.Map<String, Object> studentReg = new java.util.LinkedHashMap<>();
        studentReg.put("fullName", "Asha Rao"); studentReg.put("usn", "1AB21CS001");
        studentReg.put("email", "Asha@Example.edu"); studentReg.put("phone", "9999999999");
        studentReg.put("department", "CSE"); studentReg.put("password", "Passw0rd!1");
        studentReg.put("institutionId", "DEMO-1001");
        send(post("/api/auth/register"), null, studentReg).andExpect(status().isConflict());

        // ---- 3. two colleges verify themselves (OTP + MetaMask signature); they share one wallet ---
        ECKeyPair wallet = Keys.createEcKeyPair();
        String adminA = onboard("DEMO-1001", wallet);
        String adminB = onboard("DEMO-1002", wallet);   // shared wallet, different institution
        JsonNode after = body(mvc.perform(get("/api/auth/institution/list")).andExpect(status().isOk()));
        after.forEach(c -> { if (c.get("institutionId").asText().equals("DEMO-1001")) assertTrue(c.get("joinedKredent").asBoolean()); });

        // returning administrators sign in with institution + wallet signature
        assertEquals(adminA.isEmpty(), false);
        String adminA2 = signIn("DEMO-1001", wallet);
        send(get("/api/admin/institution"), adminA2, null).andExpect(status().isOk());

        // ---- 4. administrators only reach their own institution ------------------------------------
        send(get("/api/admin/institution"), null, null).andExpect(status().isForbidden());
        JsonNode inst = body(send(get("/api/admin/institution"), adminA, null).andExpect(status().isOk()));
        assertEquals("DEMO-1001", inst.get("institutionId").asText());

        // ---- 5. admin A creates a student; the department list reflects it --------------------------
        java.util.Map<String, Object> create = new java.util.LinkedHashMap<>(studentReg);
        create.remove("institutionId");
        JsonNode studentA = body(send(post("/api/admin/students"), adminA, create).andExpect(status().isCreated()));
        long studentAId = studentA.get("id").asLong();
        assertEquals("Greenfield Institute of Technology", studentA.get("institutionName").asText());
        assertEquals("asha@example.edu", studentA.get("email").asText(), "e-mail is stored normalised");
        JsonNode depts = body(send(get("/api/admin/departments"), adminA, null).andExpect(status().isOk()));
        long cse = 0;
        for (JsonNode d : depts) if (d.get("code").asText().equals("CSE")) cse = d.get("studentCount").asLong();
        assertEquals(1, cse);
        // duplicate USN at the same college is refused, the same USN at another college is fine
        java.util.Map<String, Object> dupEmail = new java.util.LinkedHashMap<>(create);
        dupEmail.put("email", "other@example.edu");
        send(post("/api/admin/students"), adminA, dupEmail).andExpect(status().isConflict());
        JsonNode studentB = body(send(post("/api/admin/students"), adminB, dupEmail).andExpect(status().isCreated()));
        long studentBId = studentB.get("id").asLong();

        // ---- 6. institution isolation ---------------------------------------------------------------
        assertEquals(1, body(send(get("/api/admin/students"), adminA, null)).get("content").size());
        assertEquals(1, body(send(get("/api/admin/students"), adminB, null)).get("content").size());
        send(get("/api/admin/students/" + studentAId), adminB, null).andExpect(status().isNotFound());
        java.util.Map<String, Object> certReq = new java.util.LinkedHashMap<>();
        certReq.put("studentId", studentAId); certReq.put("degreeName", "B.E. Computer Science"); certReq.put("yearOfCompletion", 2026);
        send(post("/api/admin/certificates"), adminB, certReq).andExpect(status().isNotFound());

        // ---- 7. student sign-in is tied to the chosen college ---------------------------------------
        java.util.Map<String, Object> login = new java.util.LinkedHashMap<>();
        login.put("email", "ASHA@example.edu"); login.put("password", "Passw0rd!1"); login.put("institutionId", "DEMO-1002");
        send(post("/api/auth/login"), null, login).andExpect(status().isUnauthorized());
        login.put("institutionId", "DEMO-1001");
        JsonNode studentAuth = body(send(post("/api/auth/login"), null, login).andExpect(status().isOk()));
        String studentToken = studentAuth.get("token").asText();
        assertEquals("Greenfield Institute of Technology", studentAuth.get("institution").get("name").asText());
        // self registration at a college that has joined works and lands in that college
        java.util.Map<String, Object> self = new java.util.LinkedHashMap<>(studentReg);
        self.put("usn", "1AB21CS777"); self.put("email", "selfreg@example.edu"); self.put("institutionId", "DEMO-1002");
        send(post("/api/auth/register"), null, self).andExpect(status().isCreated());
        assertEquals(2, body(send(get("/api/admin/students"), adminB, null)).get("content").size());
        assertEquals(1, body(send(get("/api/admin/students"), adminA, null)).get("content").size());

        // the sample-certificate preview works for an admin, is a PDF, and creates nothing
        byte[] previewPdf = mvc.perform(get("/api/admin/certificate-preview").header("Authorization", "Bearer " + adminA))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try (PDDocument previewDoc = PDDocument.load(previewPdf)) {
            assertEquals(1, previewDoc.getNumberOfPages());
        }
        mvc.perform(get("/api/admin/certificate-preview")).andExpect(status().is4xxClientError());

        // ---- 8. certificate issuance: metadata -> PDF -> hash -> on-chain ---------------------------
        JsonNode cert = body(send(post("/api/admin/certificates"), adminA, certReq).andExpect(status().isCreated()));
        String certId = cert.get("id").asText();
        String certNumber = cert.get("certificateNumber").asText();
        MockMultipartFile file = new MockMultipartFile("file", "degree.pdf", "application/pdf", pdf());
        JsonNode uploaded = body(send(post("/api/admin/certificates/" + certId + "/generate"), adminA, null)
                .andExpect(status().isOk()));
        String hash = uploaded.get("fileHash").asText();
        assertEquals(64, hash.length(), "SHA-256 hex hash");
        // the generated certificate is a real one-page PDF that carries the issuing college and student
        try (PDDocument generated = PDDocument.load(storedPdf.get())) {
            assertEquals(1, generated.getNumberOfPages());
            String text = new org.apache.pdfbox.text.PDFTextStripper().getText(generated);
            assertTrue(text.contains(certNumber), "certificate number printed on the PDF");
            assertTrue(text.contains("Bachelor") || text.contains("B.E."), "degree printed on the PDF");
        }

        // a draft (not yet on-chain) is invisible to the student
        assertEquals(0, body(send(get("/api/student/certificates"), studentToken, null).andExpect(status().isOk())).get("content").size());
        send(get("/api/certificates/" + certId), studentToken, null).andExpect(status().isNotFound());

        // another institution can neither see nor change it
        send(get("/api/certificates/" + certId), adminB, null).andExpect(status().isNotFound());
        send(delete("/api/admin/certificates/" + certId), adminB, null).andExpect(status().isNotFound());

        // a certificate cannot be marked MINTED by hand
        java.util.Map<String, Object> forceMinted = new java.util.LinkedHashMap<>();
        forceMinted.put("status", "MINTED");
        send(patch("/api/admin/certificates/" + certId + "/status"), adminA, forceMinted).andExpect(status().isConflict());

        // on-chain issue (RPC stubbed to confirm the transaction and the credential)
        AtomicBoolean revoked = new AtomicBoolean(false);
        AtomicReference<String> walletOfStudent = new AtomicReference<>(studentA.get("walletAddress").asText());
        when(chain.readCredential(anyLong())).thenAnswer(inv ->
                Optional.of(new OnChainCredential(certId, hash, walletOfStudent.get().toLowerCase(), revoked.get())));
        java.util.Map<String, Object> issue = new java.util.LinkedHashMap<>();
        issue.put("studentWalletAddress", walletOfStudent.get()); issue.put("certificateHash", hash);
        issue.put("tokenId", 1); issue.put("contractAddress", "0xwhatever"); issue.put("transactionHash", "0xabc123");
        JsonNode minted = body(send(post("/api/admin/certificates/" + certId + "/blockchain/issue"), adminA, issue).andExpect(status().isOk()));
        assertEquals("MINTED", minted.get("status").asText());
        assertEquals("0xcontractcontractcontractcontractcontract00", minted.get("contractAddress").asText(),
                "the contract address is taken from server configuration, not from the request");
        // the exact generated PDF verifies as authentic; a single changed byte is reported as tampered
        byte[] genuine = storedPdf.get();
        MockMultipartFile genuineFile = new MockMultipartFile("file", "c.pdf", "application/pdf", genuine);
        assertEquals("AUTHENTIC", body(mvc.perform(multipart("/api/verify/" + certNumber + "/pdf").file(genuineFile))
                .andExpect(status().isOk())).get("result").asText());
        byte[] forged = genuine.clone();
        forged[forged.length / 2] ^= 0x01;
        assertEquals("TAMPERED", body(mvc.perform(multipart("/api/verify/" + certNumber + "/pdf")
                .file(new MockMultipartFile("file", "c.pdf", "application/pdf", forged)))
                .andExpect(status().isOk())).get("result").asText());
        // if the stored file is lost, it can be restored byte-for-byte (same hash as on-chain)
        storedPdf.set(null);
        send(post("/api/admin/certificates/" + certId + "/restore-file"), adminA, null).andExpect(status().isOk());
        assertArrayEquals(genuine, storedPdf.get(), "restored file is identical to the original");
        // a minted certificate can no longer be regenerated, re-uploaded or deleted
        send(post("/api/admin/certificates/" + certId + "/generate"), adminA, null).andExpect(status().isConflict());
        mvc.perform(multipart("/api/admin/certificates/" + certId + "/upload").file(file)
                .header("Authorization", "Bearer " + adminA)).andExpect(status().isConflict());
        send(delete("/api/admin/certificates/" + certId), adminA, null).andExpect(status().isConflict());

        // ---- 9. the student and the public see it -----------------------------------------------------
        JsonNode own = body(send(get("/api/student/certificates"), studentToken, null).andExpect(status().isOk()));
        assertEquals(1, own.get("content").size());
        JsonNode pub = body(mvc.perform(get("/api/verify/" + certNumber)).andExpect(status().isOk()));
        assertEquals("VERIFIED", pub.get("result").asText());
        assertEquals("Greenfield Institute of Technology", pub.get("institution").asText());

        // ---- 10. revoke on-chain ----------------------------------------------------------------------
        revoked.set(true);
        java.util.Map<String, Object> revoke = new java.util.LinkedHashMap<>();
        revoke.put("tokenId", 1); revoke.put("transactionHash", "0xdef456"); revoke.put("reason", "Issued in error");
        JsonNode revokedCert = body(send(post("/api/admin/certificates/" + certId + "/blockchain/revoke"), adminA, revoke).andExpect(status().isOk()));
        assertEquals("REVOKED", revokedCert.get("status").asText());
        assertEquals("REVOKED", body(mvc.perform(get("/api/verify/" + certNumber)).andExpect(status().isOk())).get("result").asText());

        // ---- 11. audit trails are per institution -----------------------------------------------------
        String auditA = send(get("/api/admin/audit-logs"), adminA, null).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String auditB = send(get("/api/admin/audit-logs"), adminB, null).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(auditA.contains("CERTIFICATE_BLOCKCHAIN_ISSUED") && auditA.contains("CERTIFICATE_BLOCKCHAIN_REVOKED"));
        assertFalse(auditB.contains("CERTIFICATE_BLOCKCHAIN_ISSUED"), "institution B must not see institution A's audit trail");

        // ---- 12. registry: register a new college, verify e-mail, approve, it appears in the picker ---
        java.util.Map<String, Object> reg = new java.util.LinkedHashMap<>();
        reg.put("collegeName", "Northwind Technical University");
        reg.put("state", "Gujarat"); reg.put("district", "Ahmedabad"); reg.put("hoiName", "Dr. Priya Shah");
        reg.put("officialEmail", "hoi@northwind.example"); reg.put("contactNumber", "+91 9876543210");
        reg.put("password", "Northwind#2026"); reg.put("confirmPassword", "Northwind#2026");
        JsonNode registered = body(send(post("/api/registry/institutions"), null, reg).andExpect(status().isCreated()));
        assertFalse(registered.has("institutionId"), "the ID must not be revealed before the e-mail code is verified");
        assertEquals("PENDING", registered.get("status").asText());
        // a wrong code reveals nothing; the right code (captured from the mocked mailer) returns the ID
        send(post("/api/registry/email/verify"), null, java.util.Map.of("email", "hoi@northwind.example", "otp", "000000")).andExpect(status().is4xxClientError());
        JsonNode verified = body(send(post("/api/registry/email/verify"), null,
                java.util.Map.of("email", "hoi@northwind.example", "otp", otps.get(otps.size() - 1))).andExpect(status().isOk()));
        String nwId = verified.get("institutionId").asText();
        assertTrue(nwId.matches("KR-\\d{4}-\\d{5}"), "the registry issues the institutional ID after verification: " + nwId);
        String regToken = body(send(post("/api/registry/admin/login"), null,
                java.util.Map.of("email", "registry.admin@example.org", "password", "RegistryAdmin#2026")).andExpect(status().isOk())).get("token").asText();
        // a mail failure must not start the resend cooldown: registering with a failing mailer, then resending at once, works
        org.mockito.Mockito.doThrow(new com.kredent.backend.exception.ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "EMAIL_SEND_FAILED", "down"))
                .doAnswer(inv -> { otps.add(inv.getArgument(2)); return null; })
                .when(mail).sendRegistryEmailOtp(anyString(), anyString(), anyString(), any(Duration.class));
        java.util.Map<String, Object> reg2 = new java.util.LinkedHashMap<>(reg);
        reg2.put("collegeName", "Retry Institute"); reg2.put("officialEmail", "hoi@retry.example");
        assertFalse(body(send(post("/api/registry/institutions"), null, reg2).andExpect(status().isCreated())).get("emailSent").asBoolean());
        send(post("/api/registry/email/send"), null, java.util.Map.of("email", "hoi@retry.example")).andExpect(status().isOk());
        // ...but once a code really was sent, an immediate second request is held back by the cooldown
        send(post("/api/registry/email/send"), null, java.util.Map.of("email", "hoi@retry.example")).andExpect(status().isTooManyRequests());

        // after e-mail verification the college is approved and can use the ID on the administration login
        send(post("/api/auth/institution/lookup"), null, java.util.Map.of("institutionId", nwId)).andExpect(status().isOk());
        assertTrue(body(mvc.perform(get("/api/auth/institution/list"))).toString().contains("Northwind Technical University"));
        send(get("/api/registry/admin/institutions"), null, null).andExpect(status().isForbidden());

        // ---- 13. suspending a college cuts off its administrators and students' sign-up ----------------
        send(post("/api/registry/admin/institutions/DEMO-1001/suspend"), regToken, null).andExpect(status().isOk());
        send(get("/api/admin/students"), adminA, null).andExpect(status().isForbidden());
        assertFalse(body(mvc.perform(get("/api/auth/institution/list"))).toString().contains("DEMO-1001"));
        send(get("/api/admin/students"), adminB, null).andExpect(status().isOk());
        assertTrue(studentBId > 0);
    }
}
