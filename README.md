# WoS Porter — Windows ARM64 Porting Agent

AI-powered agents that automatically port open-source x64 Windows applications to native ARM64. Ships as a **GitHub Copilot** VS Code extension, a **Claude Code** plugin, and a **Codex CLI** plugin — use it wherever you work.

## What It Does

Give it a GitHub repository URL or a local path to an x64 project and it will:

1. **Analyze** the repo for x64-specific code (SIMD intrinsics, inline assembly, architecture guards)
2. **Port the build system** — adds ARM64 targets to CMake, MSBuild, Meson, Cargo, and 15+ other build systems
3. **Port source code** — translates SSE/AVX intrinsics to NEON, adds ARM64 preprocessor guards, fixes calling conventions
4. **Build** the project for ARM64 using MSVC, iteratively fixing compilation errors
5. **Validate** every output binary with `dumpbin` to confirm ARM64 architecture
6. **Run tests** on ARM64 hardware (when available)
7. **Generate a report** with a ready-to-apply git patch

## Requirements

- [Visual Studio 2022](https://visualstudio.microsoft.com/) with the **MSVC v143 - ARM64/ARM64EC build tools** and **Windows 11 SDK**
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension **or** [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and authenticated
- VS Code 1.100+ (for Copilot or Claude Code VS Code extension) or Claude Code CLI
- `git` on PATH

## Get Started

> **Recommended approach:** Run the agent locally using the **GitHub Copilot VS Code extension** or the **Claude Code plugin** — local runs give you full visibility and the ability to intervene when needed.  For best porting results — whether running locally or in the cloud — use a **Claude Sonnet or Opus** model.  Cloud (GitHub Actions) workflows are also available but are still evolving and may need extra checks.

- **[GitHub Copilot (VS Code Extension)](docs/copilot-installation.md)** — Install VSIX, open Copilot Chat, and start porting
- **[Claude Code (Plugin)](claude-plugin/README.md)** — Install and run as a Claude Code plugin
- **[Codex CLI (Plugin)](codex-plugin/README.md)** — Install and run as a Codex plugin
- **[Run in the Cloud (GitHub Actions)](docs/github-actions.md)** — No local ARM64 machine needed; runs on `windows-11-arm` runners. **Best for small, straightforward projects** — use Claude Code or Copilot locally for medium/complex projects.

## Skip Optimization (Porting Only)

By default the pipeline runs NEON optimization (Phase 7) after building and testing. Set `WOS_SKIP_OPTIMIZE=1` to skip it when you only need a working ARM64 port.

→ **[Skip Optimization guide](docs/skip-optimization.md)**

## x64 Competitive Analysis

Run the `x64-benchmarker` agent to capture an x64 baseline, then pass it to the porter via `WOS_X64_BENCH` to enable gap-driven differential optimization and generate an ARM64 vs x64 performance comparison table.

→ **[x64 Competitive Analysis guide](docs/x64-competitive-analysis.md)**

## Documentation

- [WoS Porter Details](docs/wos-porter-details.md) — Agents, instructions, skills, prompts, commands, supported build systems
- [Skip Optimization](docs/skip-optimization.md) — How to skip Phase 7 when only porting is needed
- [x64 Competitive Analysis](docs/x64-competitive-analysis.md) — Baseline benchmarking and differential optimization guide
- [Development](docs/development.md) — Build, package, and publish commands for contributors

## License

Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.  
SPDX-License-Identifier: BSD-3-Clause-Clear — see [LICENSE.txt](LICENSE.txt)
