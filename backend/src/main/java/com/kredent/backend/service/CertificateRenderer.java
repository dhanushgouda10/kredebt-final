package com.kredent.backend.service;

import com.kredent.backend.util.QrCodeUtil;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Draws the standard Kredent degree certificate (landscape A4) from a student's record. Every
 * college's certificate uses the same design; the college name, student details, certificate
 * number and verification QR are the only things that change. Nothing is uploaded by the admin,
 * so the final bytes are fully produced here and then hashed by CertificateService — the QR is
 * therefore part of the exact file whose SHA-256 goes on-chain.
 *
 * Only the PDF standard fonts are used (no font files to ship). Text outside their character
 * set is normalised (accents removed) or dropped by {@link #safe}, so rendering never fails on
 * an unusual name.
 */
@Service
public class CertificateRenderer {

    /** Everything that appears on the certificate. */
    public record Content(
            String collegeName,
            String studentName,
            String usn,
            String degreeName,
            String departmentName,
            String academicYear,
            LocalDate issueDate,
            String certificateNumber,
            String verificationUrl) {
    }

    private static final float W = PDRectangle.A4.getHeight();   // 841.89 (landscape)
    private static final float H = PDRectangle.A4.getWidth();    // 595.28

    private static final Color NAVY = new Color(0x0E, 0x2A, 0x5C);
    private static final Color GOLD = new Color(0xC9, 0xA2, 0x4B);
    private static final Color ORANGE = new Color(0xF7, 0x94, 0x1D);
    private static final Color INK = new Color(0x33, 0x3B, 0x4D);
    private static final Color MUTED = new Color(0x6B, 0x72, 0x80);

    private static final PDFont SERIF = PDType1Font.TIMES_ROMAN;
    private static final PDFont SERIF_ITALIC = PDType1Font.TIMES_ITALIC;
    private static final PDFont SERIF_BOLD = PDType1Font.TIMES_BOLD;
    private static final PDFont SERIF_BOLD_ITALIC = PDType1Font.TIMES_BOLD_ITALIC;

    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd MMMM yyyy", Locale.ENGLISH);

    public byte[] render(Content c) {
        return render(c, false);
    }

    /**
     * @param sample when true a diagonal SAMPLE watermark is drawn so a preview can never be
     *               mistaken for (or passed off as) a real certificate
     */
    public byte[] render(Content c, boolean sample) {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(new PDRectangle(W, H));
            document.addPage(page);
            byte[] qrPng = QrCodeUtil.generatePng(c.verificationUrl());
            PDImageXObject qr = PDImageXObject.createFromByteArray(document, qrPng, "verification-qr");

            try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
                drawFrame(cs);
                drawHeader(cs, c);
                drawBody(cs, c);
                drawFooter(cs, c, qr);
                if (sample) {
                    drawSampleWatermark(cs);
                }
            }

            document.getDocumentInformation().setTitle("Degree Certificate " + safe(c.certificateNumber()));
            document.getDocumentInformation().setCreator("Kredent");
            // PDFBox would otherwise stamp a time-based document ID, making every render differ.
            // A fixed ID derived from the certificate number keeps the output byte-for-byte
            // reproducible, so a lost file can be re-created and still match its on-chain hash.
            byte[] idBytes = java.security.MessageDigest.getInstance("MD5")
                    .digest(c.certificateNumber().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            org.apache.pdfbox.cos.COSArray id = new org.apache.pdfbox.cos.COSArray();
            id.add(new org.apache.pdfbox.cos.COSString(idBytes));
            id.add(new org.apache.pdfbox.cos.COSString(idBytes));
            document.getDocument().getTrailer().setItem(org.apache.pdfbox.cos.COSName.ID, id);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (IOException | java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("Failed to render the certificate PDF", e);
        }
    }

    // ---------------------------------------------------------------- layout

    private void drawFrame(PDPageContentStream cs) throws IOException {
        cs.setStrokingColor(NAVY);
        cs.setLineWidth(2.2f);
        cs.addRect(20, 20, W - 40, H - 40);
        cs.stroke();
        cs.setStrokingColor(GOLD);
        cs.setLineWidth(0.8f);
        cs.addRect(27, 27, W - 54, H - 54);
        cs.stroke();

        // Simple gold corner brackets.
        cs.setLineWidth(1.6f);
        float len = 46, in = 36;
        corner(cs, in, H - in, 1, -1, len);
        corner(cs, W - in, H - in, -1, -1, len);
        corner(cs, in, in, 1, 1, len);
        corner(cs, W - in, in, -1, 1, len);
    }

    private void corner(PDPageContentStream cs, float x, float y, int dx, int dy, float len) throws IOException {
        cs.moveTo(x + dx * len, y);
        cs.lineTo(x, y);
        cs.lineTo(x, y + dy * len);
        cs.stroke();
    }

    private void drawHeader(PDPageContentStream cs, Content c) throws IOException {
        centered(cs, "KREDENT  -  BLOCKCHAIN ACADEMIC CREDENTIAL PLATFORM", SERIF_BOLD, 8.5f, NAVY, W / 2, H - 52, 2.0f);

        // Neutral seal: navy disc, gold rings, simple mortarboard.
        float cx = W / 2, cy = H - 100, r = 31;
        cs.setNonStrokingColor(NAVY);
        circle(cs, cx, cy, r);
        cs.fill();
        cs.setStrokingColor(GOLD);
        cs.setLineWidth(1.6f);
        circle(cs, cx, cy, r - 3);
        cs.stroke();
        cs.setLineWidth(0.6f);
        circle(cs, cx, cy, r + 3);
        cs.stroke();
        cs.setNonStrokingColor(GOLD);
        cs.moveTo(cx - 17, cy + 3);
        cs.lineTo(cx, cy + 12);
        cs.lineTo(cx + 17, cy + 3);
        cs.lineTo(cx, cy - 6);
        cs.closePath();
        cs.fill();
        cs.addRect(cx - 8, cy - 12, 16, 6);
        cs.fill();
        centered(cs, "KREDENT", SERIF_BOLD, 5.5f, Color.WHITE, cx, cy - 21, 0.6f);

        // College name (the one thing that differs per institution) — wraps to two lines if long.
        String college = safe(c.collegeName()).toUpperCase(Locale.ENGLISH);
        drawFitted(cs, college, SERIF_BOLD, 21f, 12f, W - 150, NAVY, W / 2, H - 163, 24f);
    }

    private void drawBody(PDPageContentStream cs, Content c) throws IOException {
        float y = H - 200;
        divider(cs, y);
        centered(cs, "DEGREE CERTIFICATE", SERIF, 9f, GOLD, W / 2, y - 22, 3.0f);
        fit(cs, safe(c.degreeName()), SERIF_BOLD_ITALIC, 30f, 16f, W - 200, NAVY, W / 2, y - 58);

        centered(cs, "This is to certify that", SERIF_ITALIC, 12f, INK, W / 2, y - 86, 0);
        fit(cs, safe(c.studentName()), SERIF_BOLD_ITALIC, 25f, 14f, W - 220, NAVY, W / 2, y - 120);
        cs.setStrokingColor(GOLD);
        cs.setLineWidth(1f);
        cs.moveTo(W / 2 - 190, y - 128);
        cs.lineTo(W / 2 + 190, y - 128);
        cs.stroke();

        centered(cs, "(USN " + safe(c.usn()) + ")", SERIF, 10f, MUTED, W / 2, y - 144, 0);
        String line1 = "has successfully completed all the requirements of the programme in the";
        String line2 = "Department of " + safe(c.departmentName()) + ", and is hereby awarded this degree.";
        centered(cs, line1, SERIF, 11.5f, INK, W / 2, y - 166, 0);
        fit(cs, line2, SERIF, 11.5f, 8f, W - 160, INK, W / 2, y - 182);

        // Academic year / date of issue / certificate no.
        float baseY = y - 222;
        float[] xs = {W / 2 - 230, W / 2, W / 2 + 230};
        String[] labels = {"ACADEMIC YEAR", "DATE OF ISSUE", "CERTIFICATE NO."};
        String[] values = {safe(c.academicYear()), c.issueDate().format(DATE_FORMAT), safe(c.certificateNumber())};
        for (int i = 0; i < 3; i++) {
            centered(cs, values[i], SERIF_BOLD, 11f, NAVY, xs[i], baseY, 0);
            centered(cs, labels[i], SERIF, 7f, MUTED, xs[i], baseY - 13, 1.4f);
        }
        cs.setStrokingColor(GOLD);
        cs.setLineWidth(0.5f);
        for (float vx : new float[]{W / 2 - 115, W / 2 + 115}) {
            cs.moveTo(vx, baseY + 10);
            cs.lineTo(vx, baseY - 16);
            cs.stroke();
        }
    }

    private void drawFooter(PDPageContentStream cs, Content c, PDImageXObject qr) throws IOException {
        divider(cs, 138);
        centered(cs, "Issued and cryptographically verifiable through the Kredent blockchain credential registry.",
                SERIF_ITALIC, 8.5f, MUTED, W / 2, 124, 0);

        // Signature lines (signed on the printed copy; titles only — no names are invented).
        String[] titles = {"PRINCIPAL", "HEAD OF DEPARTMENT", "AUTHORISED SIGNATORY"};
        float[] xs = {170, 340, 510};
        cs.setStrokingColor(NAVY);
        cs.setLineWidth(0.7f);
        for (int i = 0; i < 3; i++) {
            cs.moveTo(xs[i] - 55, 72);
            cs.lineTo(xs[i] + 55, 72);
            cs.stroke();
            centered(cs, titles[i], SERIF_BOLD, 7f, NAVY, xs[i], 60, 1.2f);
        }

        // QR (bottom-right) — links to the public verification page for this certificate.
        float qrSize = 78, qx = W - 120 - qrSize, qy = 52;
        cs.setStrokingColor(GOLD);
        cs.setLineWidth(0.8f);
        cs.addRect(qx - 4, qy - 4, qrSize + 8, qrSize + 8);
        cs.stroke();
        cs.drawImage(qr, qx, qy, qrSize, qrSize);
        centered(cs, "SCAN TO VERIFY", SERIF_BOLD, 6.5f, ORANGE, qx + qrSize / 2, qy - 16, 1.0f);
    }

    private void drawSampleWatermark(PDPageContentStream cs) throws IOException {
        org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState gs =
                new org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState();
        gs.setNonStrokingAlphaConstant(0.12f);
        cs.saveGraphicsState();
        cs.setGraphicsStateParameters(gs);
        String text = "SAMPLE";
        float size = 150f;
        float width = textWidth(text, SERIF_BOLD, size);
        cs.beginText();
        cs.setFont(SERIF_BOLD, size);
        cs.setNonStrokingColor(NAVY);
        cs.setTextMatrix(org.apache.pdfbox.util.Matrix.getRotateInstance(Math.toRadians(28), W / 2 - width / 2 * 0.88f, H / 2 - 120));
        cs.showText(text);
        cs.endText();
        cs.restoreGraphicsState();
    }

    // --------------------------------------------------------------- helpers

    private void divider(PDPageContentStream cs, float y) throws IOException {
        cs.setStrokingColor(GOLD);
        cs.setLineWidth(0.6f);
        cs.moveTo(W / 2 - 250, y);
        cs.lineTo(W / 2 - 8, y);
        cs.moveTo(W / 2 + 8, y);
        cs.lineTo(W / 2 + 250, y);
        cs.stroke();
        cs.setNonStrokingColor(GOLD);
        cs.moveTo(W / 2, y + 4);
        cs.lineTo(W / 2 + 4, y);
        cs.lineTo(W / 2, y - 4);
        cs.lineTo(W / 2 - 4, y);
        cs.closePath();
        cs.fill();
    }

    private void circle(PDPageContentStream cs, float cx, float cy, float r) throws IOException {
        final float k = 0.5523f * r;
        cs.moveTo(cx - r, cy);
        cs.curveTo(cx - r, cy + k, cx - k, cy + r, cx, cy + r);
        cs.curveTo(cx + k, cy + r, cx + r, cy + k, cx + r, cy);
        cs.curveTo(cx + r, cy - k, cx + k, cy - r, cx, cy - r);
        cs.curveTo(cx - k, cy - r, cx - r, cy - k, cx - r, cy);
        cs.closePath();
    }

    private void centered(PDPageContentStream cs, String text, PDFont font, float size, Color color,
                          float cx, float y, float charSpacing) throws IOException {
        float width = textWidth(text, font, size) + charSpacing * Math.max(0, text.length() - 1);
        cs.beginText();
        cs.setFont(font, size);
        cs.setNonStrokingColor(color);
        cs.setCharacterSpacing(charSpacing);
        cs.newLineAtOffset(cx - width / 2, y);
        cs.showText(text);
        cs.endText();
        cs.setCharacterSpacing(0);
    }

    /** Single line, shrunk until it fits {@code maxWidth} (never below {@code minSize}). */
    private void fit(PDPageContentStream cs, String text, PDFont font, float size, float minSize,
                     float maxWidth, Color color, float cx, float y) throws IOException {
        float s = size;
        while (s > minSize && textWidth(text, font, s) > maxWidth) {
            s -= 0.5f;
        }
        centered(cs, text, font, s, color, cx, y, 0);
    }

    /** Like {@link #fit} but wraps onto a second line when even the minimum size is too wide. */
    private void drawFitted(PDPageContentStream cs, String text, PDFont font, float size, float minSize,
                            float maxWidth, Color color, float cx, float y, float lineHeight) throws IOException {
        if (textWidth(text, font, minSize) <= maxWidth) {
            fit(cs, text, font, size, minSize, maxWidth, color, cx, y);
            return;
        }
        String[] words = text.split(" ");
        StringBuilder first = new StringBuilder();
        int i = 0;
        while (i < words.length && textWidth((first + " " + words[i]).trim(), font, minSize) <= maxWidth) {
            first.append(first.length() == 0 ? "" : " ").append(words[i]);
            i++;
        }
        StringBuilder second = new StringBuilder();
        for (; i < words.length; i++) {
            second.append(second.length() == 0 ? "" : " ").append(words[i]);
        }
        fit(cs, first.toString(), font, minSize, 8f, maxWidth, color, cx, y + lineHeight / 3);
        fit(cs, second.toString(), font, minSize, 8f, maxWidth, color, cx, y - lineHeight / 2 + lineHeight / 3);
    }

    private float textWidth(String text, PDFont font, float size) throws IOException {
        return font.getStringWidth(text) / 1000f * size;
    }

    /**
     * Makes text safe for the PDF standard fonts (WinAnsi): removes accents, then drops anything
     * the font still cannot encode, so an unusual character can never break issuing.
     */
    static String safe(String input) {
        if (input == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(input, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        StringBuilder out = new StringBuilder();
        decomposed.codePoints().forEach(cp -> {
            String ch = new String(Character.toChars(cp));
            if (Character.isWhitespace(cp)) {
                out.append(' ');
                return;
            }
            try {
                SERIF.encode(ch);
                out.append(ch);
            } catch (Exception ignored) {
                // character not representable in the standard font — skip it
            }
        });
        return out.toString().replaceAll(" +", " ").trim();
    }
}
