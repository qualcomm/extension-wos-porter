# WoS Porter — Detailed Reference

## Agents

| Agent | Role |
|-------|------|
| `wos-porter` | Main orchestrator — runs the full 8-phase porting pipeline |
| `wos-analyzer` | Read-only deep scan of a repo for ARM64 readiness |
| `wos-build-porter` | Modifies build configurations (CMake, MSBuild, Meson, Cargo, etc.) |
| `wos-code-porter` | Ports x64-specific source code (SIMD, inline asm, arch guards); reads `wos-style.json` for indent/format |
| `wos-builder` | Builds, validates binaries with dumpbin, and fixes build errors; targeted commits (no artifacts or lock files) |
| `wos-tester` | Runs and fixes ARM64 test suites and benchmarks; stages only the specific files fixed per cycle |
| `wos-optimizer` | Applies hand-written ARM NEON intrinsics to hot kernels for performance (coverage-driven, no x64 baseline) |
| `wos-benchmark-optimizer` | Differential x64 → ARM64 optimizer; invoked only when a Windows x64 benchmark file is supplied; gap-closes functions where ARM64 ratio ≥ 1.15 behind x64 |

## Instructions

Auto-loaded (via `applyTo` globs) only when a matching file is open — keeps idle-turn token cost low.

| File | Applies to |
|------|------------|
| `wos-build-errors.instructions.md` | Build logs, `.vcxproj`/`.sln`, `CMakeLists.txt` — ARM64 compile/link error patterns |
| `wos-porting-knowledge.instructions.md` | C/C++/Rust source — high-level ARM64 porting knowledge |
| `wos-build-recipes-cmake.instructions.md` | `CMakeLists.txt`, `.cmake`, `CMakePresets.json` |
| `wos-build-recipes-msbuild.instructions.md` | `.vcxproj`, `.sln`, `.props`, `.targets`, `packages.config` |
| `wos-build-recipes-cargo.instructions.md` | `Cargo.toml`, `.cargo/config.toml`, `build.rs` |
| `wos-build-recipes-meson.instructions.md` | `meson.build`, `meson_options.txt`, cross files |
| `wos-build-recipes-nodegyp.instructions.md` | `binding.gyp`, `package.json` |
| `wos-build-recipes-python.instructions.md` | `setup.py`, `pyproject.toml`, `.pyx` |
| `wos-build-recipes-misc.instructions.md` | Autotools, Make/NMake, Bazel, GN, Premake, SCons, Waf, qmake, xmake, B2, Go/cgo |
| `wos-ci-arm64.instructions.md` | GitHub Actions, AppVeyor, Azure Pipelines, GitLab CI, Jenkins workflows — drop-in `windows-11-arm` matrix per Arm AppReady |

## Skills

Loaded on demand — never in the always-visible system prompt.

| Skill | Load when |
|-------|-----------|
| `wos-neon-reference` | Actively translating x86 SIMD intrinsics to NEON, or checking the Windows ARM64 baseline ISA |
| `wos-build-error-recipes` | Triaging an ARM64 compile/link error line-by-line |
| `wos-forbidden-skip-reasons` | Auditing an optimizer report or writing the Limitations section |
| `wos-toolchain-discovery` | Any agent needs the ARM64 `cl.exe` / `msbuild` / `dumpbin` / `vcvars` paths — result is cached to `<repo>\.copilot\state\wos-toolchain.json` and reused across phases |
| `wos-woa-dashboard` | Classifying dependencies against the [Arm Windows on Arm Software Dashboard](https://developer.arm.com/ecosystem-dashboard/windows) (native / building / unsupported / unknown + ARM64 native / Emulated x64 / Blocking); used by `wos-analyzer` Phase 2 and the Phase 8 AppReady Status section |
| `sse-avx-to-neon` | Extended SSE/AVX → NEON translation guide including PCLMULQDQ → PMULL (CRC32 kernels). Loaded by `wos-code-porter` and `wos-optimizer` when translating `_mm_*` / `_mm256_*` intrinsics |
| `intrinsics-x64-to-arm64` | STL-grounded patterns for `__m128i` / `__m256i` → NEON, `IsProcessorFeaturePresent` swap, AVX2 tail-mask conversion, `_Zeroupper_on_exit` removal, `_M_ARM64EC` guard hygiene. Used alongside `sse-avx-to-neon` for Windows C++ codebases |
| `asm-x64-to-arm64` | Translate x64 inline asm (`asm volatile`) and standalone MASM `.asm` files (PROC/ENDP) to AArch64 GAS `.S` form. Used by `wos-code-porter` when analyzer flags inline asm or hot-loop `.asm` files |
| `arm64-inlineasm-to-intrinsics` | Convert existing ARM64 `asm volatile(...)` blocks to MSVC-compatible C/C++ intrinsics, with a mandatory GoogleTest verification harness (`assets/Verification/`). Used by `wos-code-porter` and `wos-optimizer` |
| `arm64-baseline-porting` | Fallback constraints for any freeform ARM64 code emission with no more specific match — Windows ARM64 ABI, weak memory ordering, NEON 128-bit ceiling, ARM64EC ABI shims, intrinsic header hygiene |
| `jit-arm64ec-virtualalloc-fix-skill` | Detect and fix the ARM64EC JIT allocation bug where JIT pages get misclassified as x64 (missing `VirtualAlloc2` + `MEM_EXTENDED_PARAMETER_EC_CODE`). Used by `wos-analyzer` Step 4e and downstream `wos-code-porter` |

## Prompts

| Prompt | Purpose |
|--------|---------|
| `wos-verify-port.prompt.md` | Phase 8 semantic-gate verification (`G1`–`G8`): re-derives toolchain state, runs dumpbin, verifies commit/test/benchmark/NEON claims against the filesystem before writing `ARM64-PORT.md` |

## VS Code Commands

| Command | Description |
|---------|-------------|
| `WoS Porter: Install Assets` | Install/reinstall agents, instructions, skills, and prompts under `~/.copilot/{agents,instructions,skills,prompts}` and register the four locations with Copilot Chat |
| `WoS Porter: Uninstall Assets` | Remove all installed files and settings entries |
| `WoS Porter: Check Asset Status` | Show installed counts (agents / instructions / skills / prompts) |

## Supported Build Systems

CMake, MSBuild/Visual Studio, Meson, Make/NMake, Cargo (Rust), Autotools, Bazel, GN, Premake, SCons, Waf, qmake, xmake, B2/Boost.Build, Go, node-gyp, .NET SDK, Gradle, Python C extensions.

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `WOS_PORTER_WORKDIR` | `C:\src\wos-porter` (Windows), `$HOME/wos-porter` (other) | Root folder where the porter clones target repos and writes `<repo>\.copilot\state\wos-toolchain.json`. Set this if the default drive is unwritable or you need clones on a different volume. |

## State Files Written per Repo

| File | Written by | Consumed by |
|------|-----------|-------------|
| `<repo>\.copilot\state\wos-toolchain.json` | `wos-toolchain-discovery` skill (Phase 4) | `wos-builder`, `wos-tester`, `wos-optimizer` |
| `<repo>\.copilot\state\wos-style.json` | `wos-porter` Phase 1 step 2a | All agents that edit source or create commits |
| `<repo>\.copilot\state\wos-deps.json` | `wos-porter` Phase 4 | Phase 5 build, Phase 8 report |
| `<repo>\.copilot\state\optimizer-deferred.json` | `wos-optimizer` / `wos-benchmark-optimizer` | Phase 7 budget-resume loop |
| `<repo>\benchmarks\base_bench_win_arm.*` | `wos-tester` Phase 6 | Phase 7 differential optimizer, Phase 8 report |
| `<repo>\ARM64-PORT.md` | `wos-porter` Phase 8 | Final deliverable — build, run-tests, run-benchmarks steps + perf tables |

`wos-style.json` fields: `indentStyle`, `indentSize`, `lineEnding`, `clangFormatPresent`, `commitConvention` (`conventional` | `imperative`), `commitSample`.