package com.kredent.backend.benchmark;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.kredent.backend.service.PdfStampingService;
import com.kredent.backend.util.HashUtil;
import com.kredent.backend.util.QrCodeUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.io.BufferedWriter;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Stage 1 micro-benchmark: PDF QR stamping and SHA-256 hashing, measured SEPARATELY, on the real
 * production code (PdfStampingService.stampQrCode, HashUtil.sha256Hex) called in-process. No
 * HTTP, database, storage or blockchain is involved, so the numbers isolate the two operations.
 *
 * Skipped unless -Dkredent.bench=true is passed, so `mvn test` and CI are unaffected.
 *
 * Per fixture size and per iteration, three timings are taken with System.nanoTime():
 *   qr_generate : QrCodeUtil.generatePng(url)            (sub-component of stamping, for context)
 *   stamp       : PdfStampingService.stampQrCode(pdf, url) (includes its own QR generation,
 *                                                          exactly as production does)
 *   sha256      : HashUtil.sha256Hex(stampedBytes)        (hash of the STAMPED output, which is
 *                                                          what CertificateService.uploadFile hashes)
 * Each timer wraps only its own call. Warm-up iterations are written to the CSV with
 * phase=warmup and excluded from the summary.
 *
 * Optional system properties:
 *   kredent.bench.runId       groups several JVM launches under one results folder (default: timestamp)
 *   kredent.bench.launch      label for this JVM launch (default: 1)
 *   kredent.bench.warmup      warm-up iterations per size (default: 50)
 *   kredent.bench.iterations  measured iterations per size (default: 300)
 *   kredent.bench.resultsDir  results root (default: ../benchmarks/results, relative to backend/)
 *   kredent.bench.fixturesDir where the generated PDFs are saved (default: ../benchmarks/fixtures)
 */
@EnabledIfSystemProperty(named = "kredent.bench", matches = "true")
class StampingHashingBenchmarkTest {

    private record Fixture(String label, long targetBytes) {}

    private static final List<Fixture> FIXTURES = List.of(
            new Fixture("0.1MB", 100_000L),
            new Fixture("1MB", 1_000_000L),
            new Fixture("5MB", 5_000_000L));   // below the app's 5 MiB (5,242,880 byte) upload limit

    private static final double SIZE_TOLERANCE = 0.01;
    // Same shape as production: FRONTEND_BASE_URL default + "/verify/" + certificate number.
    private static final String URL_PREFIX = "http://localhost:5173/verify/SKC-2026-";

    @Test
    void stampingAndHashing() throws Exception {
        String runId = System.getProperty("kredent.bench.runId",
                DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC).format(Instant.now()));
        String launch = System.getProperty("kredent.bench.launch", "1");
        int warmup = Integer.getInteger("kredent.bench.warmup", 50);
        int iterations = Integer.getInteger("kredent.bench.iterations", 300);
        Path resultsRoot = Paths.get(System.getProperty("kredent.bench.resultsDir", "../benchmarks/results"));
        Path fixturesDir = Paths.get(System.getProperty("kredent.bench.fixturesDir", "../benchmarks/fixtures"));

        Path outDir = resultsRoot.resolve(runId).resolve("stamping-hashing").resolve("launch-" + launch);
        Files.createDirectories(outDir);
        Files.createDirectories(fixturesDir);

        PdfStampingService stampingService = new PdfStampingService();
        ObjectMapper json = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

        Map<String, Object> fixtureInfo = new LinkedHashMap<>();
        Map<String, Object> summary = new LinkedHashMap<>();
        long blackhole = 0;

        Path csv = outDir.resolve("stamping_hashing_raw.csv");
        try (BufferedWriter w = Files.newBufferedWriter(csv, StandardCharsets.UTF_8)) {
            w.write("run_id,launch,size_label,input_bytes,output_bytes,operation,phase,iteration,nanos\n");

            for (Fixture fixture : FIXTURES) {
                byte[] input = BenchPdfFixtures.build(fixture.targetBytes(), SIZE_TOLERANCE);
                String inputSha = HashUtil.sha256Hex(input);
                Path fixtureFile = fixturesDir.resolve("fixture-" + fixture.label().replace(".", "_") + ".pdf");
                Files.write(fixtureFile, input);
                fixtureInfo.put(fixture.label(), Map.of(
                        "targetBytes", fixture.targetBytes(),
                        "actualBytes", input.length,
                        "sha256", inputSha,
                        "pages", 1,
                        "file", fixtureFile.toAbsolutePath().normalize().toString()));

                List<Double> qrMs = new ArrayList<>();
                List<Double> stampMs = new ArrayList<>();
                List<Double> hashMs = new ArrayList<>();
                long outputBytes = 0;

                for (int i = 0; i < warmup + iterations; i++) {
                    boolean measured = i >= warmup;
                    String phase = measured ? "measure" : "warmup";
                    int iteration = measured ? i - warmup + 1 : i + 1;
                    // Unique certificate number per iteration, built outside every timed region.
                    String url = URL_PREFIX + String.format("%08X", i);

                    long t0 = System.nanoTime();
                    byte[] qr = QrCodeUtil.generatePng(url);
                    long qrNanos = System.nanoTime() - t0;

                    t0 = System.nanoTime();
                    byte[] stamped = stampingService.stampQrCode(input, url);
                    long stampNanos = System.nanoTime() - t0;

                    t0 = System.nanoTime();
                    String hash = HashUtil.sha256Hex(stamped);
                    long hashNanos = System.nanoTime() - t0;

                    // Consume every result so the JIT cannot discard the work.
                    blackhole += qr.length + stamped.length + hash.hashCode();
                    outputBytes = stamped.length;

                    writeRow(w, runId, launch, fixture, input.length, stamped.length, "qr_generate", phase, iteration, qrNanos);
                    writeRow(w, runId, launch, fixture, input.length, stamped.length, "stamp", phase, iteration, stampNanos);
                    writeRow(w, runId, launch, fixture, input.length, stamped.length, "sha256", phase, iteration, hashNanos);

                    if (measured) {
                        qrMs.add(qrNanos / 1e6);
                        stampMs.add(stampNanos / 1e6);
                        hashMs.add(hashNanos / 1e6);
                    }
                }

                Map<String, Object> sizeSummary = new LinkedHashMap<>();
                sizeSummary.put("inputBytes", input.length);
                sizeSummary.put("stampedOutputBytes", outputBytes);
                sizeSummary.put("stamp_ms", BenchStats.summarize(stampMs));
                sizeSummary.put("sha256_ms", BenchStats.summarize(hashMs));
                sizeSummary.put("qr_generate_ms", BenchStats.summarize(qrMs));
                summary.put(fixture.label(), sizeSummary);
            }
        }

        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("runId", runId);
        parameters.put("launch", launch);
        parameters.put("warmupIterations", warmup);
        parameters.put("measuredIterations", iterations);
        parameters.put("sizeTolerance", SIZE_TOLERANCE);
        parameters.put("fixtureSeed", BenchPdfFixtures.SEED);
        parameters.put("timer", "System.nanoTime(), one timer per operation call");
        parameters.put("percentileMethod", "nearest-rank: value at position ceil(p/100*n) of sorted samples");

        json.writeValue(outDir.resolve("fixtures.json").toFile(), fixtureInfo);
        json.writeValue(outDir.resolve("summary.json").toFile(), Map.of("parameters", parameters, "results", summary));
        json.writeValue(outDir.resolve("environment.json").toFile(), environment());

        System.out.println("[bench] blackhole=" + blackhole);
        System.out.println("[bench] results written to " + outDir.toAbsolutePath().normalize());
    }

    private static void writeRow(BufferedWriter w, String runId, String launch, Fixture fixture, int inputBytes,
                                 int outputBytes, String operation, String phase, int iteration, long nanos)
            throws IOException {
        w.write(runId + "," + launch + "," + fixture.label() + "," + inputBytes + "," + outputBytes + ","
                + operation + "," + phase + "," + iteration + "," + nanos + "\n");
    }

    private static Map<String, Object> environment() {
        Map<String, Object> env = new LinkedHashMap<>();
        env.put("capturedAtUtc", Instant.now().toString());
        env.put("javaVersion", System.getProperty("java.version"));
        env.put("javaVendor", System.getProperty("java.vendor"));
        env.put("javaVm", System.getProperty("java.vm.name") + " " + System.getProperty("java.vm.version"));
        env.put("jvmArgs", ManagementFactory.getRuntimeMXBean().getInputArguments());
        env.put("osName", System.getProperty("os.name"));
        env.put("osVersion", System.getProperty("os.version"));
        env.put("osArch", System.getProperty("os.arch"));
        env.put("availableProcessors", Runtime.getRuntime().availableProcessors());
        env.put("maxHeapBytes", Runtime.getRuntime().maxMemory());
        if (ManagementFactory.getOperatingSystemMXBean() instanceof com.sun.management.OperatingSystemMXBean os) {
            env.put("totalPhysicalMemoryBytes", os.getTotalMemorySize());
        }
        env.put("cpuModel", runQuietly("sysctl", "-n", "machdep.cpu.brand_string"));
        env.put("pdfboxVersion", org.apache.pdfbox.util.Version.getVersion());
        env.put("gitCommit", runQuietly("git", "rev-parse", "HEAD"));
        env.put("gitWorkingTreeDirty", !runQuietly("git", "status", "--porcelain").isEmpty());
        return env;
    }

    /** Best-effort shell-out for environment details; returns "" if the command is unavailable. */
    private static String runQuietly(String... command) {
        try {
            Process p = new ProcessBuilder(command).redirectErrorStream(true).start();
            String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            return p.waitFor(5, TimeUnit.SECONDS) && p.exitValue() == 0 ? out : "";
        } catch (Exception e) {
            return "";
        }
    }
}
