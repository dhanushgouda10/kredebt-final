package com.kredent.backend.benchmark;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Summary statistics for benchmark samples. The definitions here are the single source of truth
 * for the Java side and are mirrored exactly by benchmarks/lib/stats.mjs on the Node side:
 *
 *   median  = middle value of the sorted samples (mean of the two middle values when n is even)
 *   pXX     = nearest-rank percentile: the value at 1-based position ceil(XX/100 * n) of the
 *             sorted samples
 *   stddev  = sample standard deviation (n - 1 denominator)
 *
 * Benchmark-only code: lives under src/test, never part of the application.
 */
final class BenchStats {

    private BenchStats() {
    }

    /** @param values samples in any unit; the summary is reported in the same unit */
    static Map<String, Object> summarize(List<Double> values) {
        Map<String, Object> out = new LinkedHashMap<>();
        int n = values.size();
        out.put("n", n);
        if (n == 0) {
            return out;
        }
        double[] sorted = values.stream().mapToDouble(Double::doubleValue).sorted().toArray();
        double sum = Arrays.stream(sorted).sum();
        double mean = sum / n;
        double sq = 0;
        for (double v : sorted) {
            sq += (v - mean) * (v - mean);
        }
        out.put("median", median(sorted));
        out.put("p95", nearestRank(sorted, 95));
        out.put("p99", nearestRank(sorted, 99));
        out.put("mean", mean);
        out.put("min", sorted[0]);
        out.put("max", sorted[n - 1]);
        out.put("stddev", n > 1 ? Math.sqrt(sq / (n - 1)) : 0.0);
        return out;
    }

    static double median(double[] sorted) {
        int n = sorted.length;
        return n % 2 == 1 ? sorted[n / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;
    }

    static double nearestRank(double[] sorted, double percentile) {
        int rank = (int) Math.ceil(percentile / 100.0 * sorted.length);
        return sorted[Math.max(1, rank) - 1];
    }
}
