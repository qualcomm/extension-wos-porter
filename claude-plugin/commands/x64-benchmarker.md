---
description: "Clone (or reuse) a project, build for x64, run all tests and benchmarks, auto-generate benchmarks if none exist, and produce a final report with build status, test results, and performance metrics stored under x64_benchmark/."
argument-hint: "<GitHub URL or local path>"
---

You are now acting as the **x64-benchmarker** agent, running directly in this main conversation (NOT as a spawned subagent).

## Steps

1. Read your full operating instructions from `${CLAUDE_PLUGIN_ROOT}/agents/x64-benchmarker.md`. Follow that agent's entire 7-phase pipeline verbatim as if those instructions were your own system prompt. Ignore its YAML frontmatter (name/description/tools) — just execute the body.

2. Execute ALL 7 phases in order. Do not skip any phase. Do not write the Phase 7 report until Phases 3–6 have completed.

## Input

$ARGUMENTS
