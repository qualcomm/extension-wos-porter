# Changelog

## 1.0.3

- **Clean commit discipline**: replaced `git add -A` in `wos-builder` and `wos-tester` with filtered `git diff --name-only` staging that excludes build artifacts (`.ilk`, `.pdb`, `.tlog`), IDE state (`.vs/`), and lock files. Added `git diff --cached --stat` pre-commit verification across all phases.
- **Per-category commit handling**: after Phase 7, uncommitted files are handled one category at a time — benchmark results, `.gitignore`, and source changes each get their own dedicated commit; temporary agent scripts are deleted rather than committed.
- **Coding style detection (Phase 1 step 2a)**: after `git clone`, the orchestrator detects `.editorconfig`, `.clang-format`, and commit convention from `git log --oneline -15`, writing results to `<repo>\.copilot\state\wos-style.json`. All sub-agents read this file for indent style and commit message formatting.
- **Skip optimization flag**: added `WOS_SKIP_OPTIMIZE` support — can be set as an env var (`$env:WOS_SKIP_OPTIMIZE = '1'`) or passed inline in the prompt. Phase 7 is bypassed unconditionally; Phase 8 notes the skip in the NEON Optimizations section.
- **New docs**: `docs/skip-optimization.md` and `docs/x64-competitive-analysis.md` with full workflow guides; complexity disclaimer added to `docs/github-actions.md` directing medium/complex projects to local Claude Code or Copilot.
- **Updated `docs/wos-porter-details.md`**: added `wos-benchmark-optimizer` agent entry, new state files table, and pipeline flow link.

## 1.0.2

- **Refactor for token efficiency**: agent descriptions trimmed, instructions gated with `applyTo`, duplicated content extracted into on-demand skills and prompts. Idle-turn context drops from ~7.5K to ~1.4K tokens; full-pipeline context drops ~40–60%.
- **New skills** (loaded on demand):
  - `wos-neon-reference` — SSE/AVX → NEON tables, Windows ARM64 baseline ISA (AES/SHA1/SHA2/PMULL/CRC32), ARMv8.2+ optional features
  - `wos-build-error-recipes` — C-series / LNK / D80xx / platform-config error triage
  - `wos-forbidden-skip-reasons` — canonical forbidden vs valid skip-reason list + audit regex (used by wos-optimizer and Phase 8 gate G7c)
  - `wos-toolchain-discovery` — MSVC ARM64 toolchain resolution with per-repo JSON cache
  - `wos-woa-dashboard` — curated Windows on Arm Ecosystem Dashboard lookup for ~50 common C/C++, Rust, Node, Python, .NET packages with native/building/unsupported/unknown classification
- **New per-build-system recipe instructions** (auto-loaded via `applyTo` on the matching manifest file): CMake, MSBuild, Cargo, Meson, node-gyp, Python C ext, plus a "misc" file for Autotools/Make/Bazel/GN/Premake/SCons/Waf/qmake/xmake/B2/Go
- **New CI instruction** `wos-ci-arm64` — GitHub Actions `windows-11-arm`, AppVeyor, Azure Pipelines, GitLab, Jenkins recipes aligned with Arm AppReady
- **New prompt** `wos-verify-port` — the Phase 8 semantic gate (G1–G8) extracted from the porter agent body
- **wos-analyzer**: new heuristics for kernel-mode/driver code (`*.sys`, KMDF/WDM/NDIS/hypervisor), hardcoded arch checks across C/C++/Rust/Go/.NET/Node/Python, CI matrix arch gaps, `dumpbin` verification of prebuilt binaries, and Arm AppReady Assessment Summary in the report
- **wos-porter**: Phase 8 report template now includes an `Arm AppReady Status` section (target profile, stages reached, dashboard status, runtime classification, App Assure escalation)
- **Extension**: installs and registers agents / instructions / skills / prompts under `~/.copilot/{agents,instructions,skills,prompts}` and wires all four `chat.*Locations` settings
- README: documents new asset categories and updated Claude Code setup covering all four folders

## 1.0.1

- Fix: agent files are now removed from `~/.copilot/agents/` on extension uninstall (added the missing `uninstall.js` referenced by the `vscode:uninstall` hook)
- Add `wos-tester` and `wos-optimizer` agents to the install/uninstall set (now 7 agents total)
- Harden agent file path handling against path traversal
- README: document using the agents in Claude Code via a `/wos-porter` slash command

## 1.0.0

- Initial release
- 5 custom Copilot agents for ARM64 porting workflow
- 2 instruction files with ARM64 build error and porting knowledge references
- Auto-install on first activation
- Commands: Install, Uninstall, Check Status
