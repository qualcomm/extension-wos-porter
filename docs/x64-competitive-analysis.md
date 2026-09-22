# x64 Competitive Analysis

Measure how ARM64 performance compares against x64 after porting using a two-step workflow.

## Step 1 — Capture the x64 Baseline

Use the **`x64-benchmarker`** agent on an x64 machine (or x64-emulated shell) before or independently of the port:

```
@wos-porter /x64-benchmarker https://github.com/owner/repo
```

This clones the project, builds it for x64, runs all benchmarks (auto-generating them if none exist), and writes results to `x64_benchmark/` in the work directory. The key output file is the benchmark result (e.g. `x64_benchmark/bench_results.json` or `.txt`).

> The `x64-benchmarker` agent works on any machine — it does not require ARM64 hardware.

## Step 2 — Port with Differential Optimization

Pass the x64 benchmark file to the porter as a second argument or via environment variable:

```powershell
# Option A — environment variable (set once, reuse across runs)
$env:WOS_X64_BENCH = 'C:\src\wos-porter\x64_benchmark\bench_results.json'
# then invoke porter normally

# Option B — second positional argument
@wos-porter https://github.com/owner/repo C:\src\wos-porter\x64_benchmark\bench_results.json
```

When `WOS_X64_BENCH` is set the porter uses **`wos-benchmark-optimizer`** (Phase 7) instead of the standard `wos-optimizer`. It:

1. Aligns the x64 baseline against the ARM64 benchmark captured in Phase 6
2. Ranks functions where ARM64 is slowest relative to x64 (gap ≥ 1.15×)
3. Optimizes exactly those functions with hand-written `arm_neon.h` intrinsics
4. Skips functions already at parity — no unnecessary churn

## Output

The generated `ARM64-PORT.md` and final chat report include a unified comparison table:

| Benchmark | x64 | ARM64 Pre-opt | ARM64 Post-opt | Gap (×) | Status |
|-----------|-----|---------------|----------------|---------|--------|
| example   | 1200 MB/s | 800 MB/s | 1100 MB/s | 1.09× | ✓ improved |

All numbers are sourced directly from the benchmark files on disk — never fabricated.

## Fallback Behaviour

If `WOS_X64_BENCH` points to a file that does not exist on disk, the porter warns and automatically falls back to the standard coverage-driven `wos-optimizer`.

## When to Use This

| Scenario | Recommendation |
|----------|---------------|
| You want to know how ARM64 stacks up against x64 | Run x64-benchmarker first, then port with WOS_X64_BENCH |
| You want gap-targeted NEON optimization (not blanket) | Use differential path |
| No x64 baseline available | Use standard porter (coverage-driven optimizer) |
| Only need a working port, no perf comparison | Set WOS_SKIP_OPTIMIZE=1 — see [skip-optimization.md](skip-optimization.md) |
