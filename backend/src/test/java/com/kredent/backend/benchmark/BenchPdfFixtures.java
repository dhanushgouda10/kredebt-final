package com.kredent.backend.benchmark;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Random;

/**
 * Builds deterministic single-page A4 certificate-style PDFs of a target byte size, using the
 * same PDF library the application uses (PDFBox 2.x).
 *
 * Each PDF has a few lines of certificate text plus one embedded image filled with seeded random
 * noise. Noise does not compress, so the image's pixel count controls the file size almost
 * linearly; the height is adjusted until the file lands within the requested tolerance. The same
 * seed and target always produce byte-identical output, so a run can be reproduced exactly.
 *
 * Benchmark-only code: lives under src/test, never part of the application.
 */
final class BenchPdfFixtures {

    static final long SEED = 20261107L;
    private static final int MAX_ATTEMPTS = 12;

    private BenchPdfFixtures() {
    }

    /**
     * @param targetBytes exact size wanted
     * @param tolerance   allowed relative deviation, e.g. 0.01 for +-1%
     */
    static byte[] build(long targetBytes, double tolerance) throws IOException {
        // Roughly square image; one pixel row then adds ~3 * width bytes, small enough to land
        // inside a 1% tolerance at every size used here (0.1 MB rows are ~550 bytes).
        int width = (int) Math.max(16, Math.sqrt(targetBytes / 3.0));
        long bytesPerRow = width * 3L;
        int height = Math.max(1, (int) (targetBytes / bytesPerRow));
        byte[] best = null;
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            byte[] pdf = render(width, height);
            if (best == null || Math.abs(pdf.length - targetBytes) < Math.abs(best.length - targetBytes)) {
                best = pdf;
            }
            double deviation = (pdf.length - (double) targetBytes) / targetBytes;
            if (Math.abs(deviation) <= tolerance) {
                return pdf;
            }
            long rowDelta = (targetBytes - pdf.length) / bytesPerRow;
            height = (int) Math.max(1, height + (rowDelta == 0 ? Long.signum(targetBytes - pdf.length) : rowDelta));
        }
        double deviation = (best.length - (double) targetBytes) / targetBytes;
        throw new IllegalStateException(String.format(
                "Could not build a %d-byte fixture within %.2f%% (closest: %d bytes, %.2f%%)",
                targetBytes, tolerance * 100, best.length, deviation * 100));
    }

    private static byte[] render(int imageWidth, int imageHeight) throws IOException {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);

            BufferedImage noise = new BufferedImage(imageWidth, imageHeight, BufferedImage.TYPE_INT_RGB);
            Random random = new Random(SEED);
            for (int y = 0; y < imageHeight; y++) {
                for (int x = 0; x < imageWidth; x++) {
                    noise.setRGB(x, y, random.nextInt(0x1000000));
                }
            }
            PDImageXObject image = LosslessFactory.createFromImage(document, noise);

            PDRectangle box = page.getMediaBox();
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                // Background artwork area, kept clear of the bottom-right corner where the app stamps the QR.
                content.drawImage(image, 60, 160, box.getWidth() - 120, box.getHeight() - 320);

                content.beginText();
                content.setFont(PDType1Font.HELVETICA_BOLD, 22);
                content.newLineAtOffset(60, box.getHeight() - 90);
                content.showText("MVJ College of Engineering");
                content.setFont(PDType1Font.HELVETICA, 14);
                content.newLineAtOffset(0, -30);
                content.showText("Benchmark fixture - not a real certificate");
                content.newLineAtOffset(0, -20);
                content.showText("Bachelor of Engineering, Computer Science and Engineering, 2026");
                content.endText();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        }
    }
}
