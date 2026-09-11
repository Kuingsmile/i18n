# Performance benchmark

Run from the repository root after installing dependencies:

```sh
npm run benchmark
npm run benchmark -- --output benchmark/results/baseline.json
# After changing the source:
npm run benchmark -- --compare benchmark/results/baseline.json --output benchmark/results/current.json
```

`npm run benchmark` rebuilds the package and measures the Node ESM distribution. To measure an already built
distribution without rebuilding, run `node benchmark/index.mjs`. No additional dependencies are required. JSON reports
in `benchmark/results/` are ignored by Git, and the benchmark directory is excluded from the npm package. In PowerShell,
use `npm.cmd` when forwarding options (for example, `npm.cmd run benchmark -- --filter interpolation`), or invoke the
Node script directly after building, to avoid `npm.ps1` consuming the argument separator.

## Workloads

- Flat and nested object translations, plus rotation through 256 and 4,096 nested keys.
- Interpolation with one token, four tokens including a repeated argument, and unused arguments.
- Missing phrases, missing languages, and entirely missing keys.
- Alternating languages, replacing locale maps, and construction followed by a first translation.
- Cached file translations, first loads of a 4,096-message JSON file, and directory discovery plus loading.

All translations use synthetic fixtures. Setup validates expected results before timing, including all rotating keys.
Locale files are created in a temporary directory and removed in a `finally` block. Construction and first file reads
are included only in the workloads that name them. Other workloads reuse instances and arguments.

## Methodology

Each workload calibrates its batch size, warms up for 200 ms, then collects nine samples of at least 100 ms each. Timing
is taken around batches to reduce clock overhead. A checksum consumes the returned string lengths or missing values.
Results report median nanoseconds per operation, its corresponding operations per second, and the minimum-to-maximum
sample range. JSON includes all samples, operation counts, durations, runtime and CPU metadata, and sampling settings. A
speedup above `1.00x` means the current median is faster than the baseline median.

Options:

```sh
# Longer measurements (use identical options for the baseline and comparison):
npm run benchmark -- --samples 15 --time 150 --warmup 300 --output benchmark/results/long.json
# Focus on a group:
npm run benchmark -- --filter interpolation
node benchmark/index.mjs --help
```

Measurements are sequential and include loop/function-call overhead. The benchmark silences exported logger methods, so
fallback and missing-key results exclude log formatting and terminal I/O. A "cold" file load uses a new adapter each
time; the operating system's file cache stays warm. These are throughput microbenchmarks, not per-request latency
percentiles, memory measurements, or end-to-end application tests. Browser runtime performance is not measured.

Compare on the same machine and Node version with the same options and minimal background activity. Repeat runs,
especially when sample ranges overlap; small differences can be noise. The comparison warns about differing environments
or sampling settings. It deliberately does not enforce timing thresholds in tests.
