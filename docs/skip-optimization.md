# Skip Optimization (Porting Only)

By default the pipeline runs NEON optimization (Phase 7) after building and testing. If you only need the port to compile and pass tests — without spending tokens on NEON intrinsic work — you can skip it in two ways:

## Option A — In the prompt

Mention `WOS_SKIP_OPTIMIZE=1` directly in your chat message to the porter:

```
@wos-porter https://github.com/owner/repo WOS_SKIP_OPTIMIZE=1
```

or naturally in prose:

```
Port https://github.com/owner/repo to ARM64, skip optimization (WOS_SKIP_OPTIMIZE=1)
```

The agent reads it from the prompt and sets the flag before Phase 7.

## Option B — Environment variable

Set the variable in your shell before invoking the porter:

```powershell
$env:WOS_SKIP_OPTIMIZE = '1'
```

Then invoke the porter normally. Unset the variable (or close the terminal) to re-enable optimization on the next run.

---

In both cases, Phase 7 is skipped entirely and the final report notes "Phase 7 skipped — WOS_SKIP_OPTIMIZE set".

## When to Use This

| Scenario | Recommendation |
|----------|---------------|
| Validating that a project compiles and tests pass on ARM64 | Skip optimization |
| Measuring token usage of Phases 1–6 + 8 alone | Skip optimization |
| You need a working ARM64 port quickly and will optimize later | Skip optimization |
| You want maximum ARM64 performance and have time/budget | Run full pipeline (default) |

## Effect on ARM64-PORT.md

When skipped, the NEON Optimizations section of `ARM64-PORT.md` will read:

> **Functions optimized**: None — Phase 7 skipped (WOS_SKIP_OPTIMIZE set)

All other sections (build steps, test results, benchmark results) are unaffected.
