package com.kredent.backend.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CertificateRendererTest {

    private final CertificateRenderer renderer = new CertificateRenderer();

    private CertificateRenderer.Content content(String college, String student) {
        return new CertificateRenderer.Content(college, student, "1MJ21CS001", "Bachelor of Engineering",
                "Computer Science and Engineering", "2026 - 2027", LocalDate.of(2027, 6, 30),
                "SKC-2027-AB12CD34", "http://localhost:5173/verify/SKC-2027-AB12CD34");
    }

    private String text(byte[] pdf) throws Exception {
        try (PDDocument doc = PDDocument.load(pdf)) {
            assertEquals(1, doc.getNumberOfPages());
            return new PDFTextStripper().getText(doc);
        }
    }

    @Test
    void fillsAllPlaceholders() throws Exception {
        String t = text(renderer.render(content("Greenfield Institute of Technology", "Asha Rao")));
        assertTrue(t.contains("GREENFIELD INSTITUTE OF TECHNOLOGY"));
        assertTrue(t.contains("Asha Rao"));
        assertTrue(t.contains("1MJ21CS001"));
        assertTrue(t.contains("Bachelor of Engineering"));
        assertTrue(t.contains("SKC-2027-AB12CD34"));
        assertTrue(t.contains("30 June 2027"));
        assertTrue(t.contains("2026 - 2027"));
    }

    @Test
    void survivesUnusualTextAndVeryLongNames() throws Exception {
        String longCollege = "The Extraordinarily Long Named Institute of Advanced Technology and Management Sciences, Affiliated Campus";
        byte[] pdf = renderer.render(content(longCollege, "José Ñuñez దనుష్ 张伟"));
        String t = text(pdf);
        assertTrue(t.contains("Jose Nunez"));
    }

    @Test
    void sameInputGivesValidDistinctPdfsPerCertificateNumber() throws Exception {
        byte[] a = renderer.render(content("A College", "A"));
        CertificateRenderer.Content other = new CertificateRenderer.Content("A College", "A", "U", "BE", "CSE",
                "2026 - 2027", LocalDate.of(2027, 6, 30), "SKC-2027-ZZZZ0000", "http://x/verify/SKC-2027-ZZZZ0000");
        byte[] b = renderer.render(other);
        assertTrue(!java.util.Arrays.equals(a, b));
    }

    @Test
    void sampleWatermarkRendersAndStillPassesAsOnePagePdf() throws Exception {
        byte[] sample = renderer.render(content("Greenfield Institute of Technology", "Student Name"), true);
        assertTrue(text(sample).contains("Student Name"));
        assertTrue(!java.util.Arrays.equals(sample, renderer.render(content("Greenfield Institute of Technology", "Student Name"))));
    }

    @Test
    void sameInputGivesIdenticalBytes() throws Exception {
        CertificateRenderer.Content c = content("A College", "A Student");
        byte[] first = renderer.render(c);
        Thread.sleep(1100);
        assertArrayEquals(first, renderer.render(c), "rendering must be reproducible so a lost file can be restored");
    }
}
