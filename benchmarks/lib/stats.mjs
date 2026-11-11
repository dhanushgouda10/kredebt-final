// Summary statistics, mirroring backend/src/test/java/com/kredent/backend/benchmark/BenchStats.java:
//   median = middle of sorted samples (mean of the two middle values when n is even)
//   pXX    = nearest-rank: value at 1-based position ceil(XX/100 * n) of the sorted samples
//   stddev = sample standard deviation (n - 1 denominator)

export function nearestRank(sorted, percentile) {
  const rank = Math.ceil((percentile / 100) * sorted.length)
  return sorted[Math.max(1, rank) - 1]
}

export function summarize(values) {
  const n = values.length
  if (n === 0) return { n: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = sorted.reduce((s, v) => s + v, 0) / n
  const variance = n > 1 ? sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  return {
    n,
    median,
    p95: nearestRank(sorted, 95),
    p99: nearestRank(sorted, 99),
    mean,
    min: sorted[0],
    max: sorted[n - 1],
    stddev: Math.sqrt(variance),
  }
}
