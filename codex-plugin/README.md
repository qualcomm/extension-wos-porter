# WoS Porter — Codex plugin

This repo contains the **wos-porter** plugin, which ports open-source x64 Windows applications to native ARM64.

## Install the plugin (one-time)

**Option A — from a local clone:**

```
codex plugin marketplace add C:\path\to\extension-wos-porter
codex plugin add wos-porter@extension-wos-porter
```

**OR**

**Option B — from GitHub:**

```
codex plugin marketplace add qualcomm/extension-wos-porter
codex plugin add wos-porter@extension-wos-porter
```

> **Note:** Restart Codex after installing for the plugin to take effect.

## Usage

```
@wos-porter https://github.com/owner/repo
```

This runs the full 8-phase pipeline: clone → analyze → port build + source → resolve deps → build → test → NEON optimize → report.

### Optional flags

Pass inline in your message — no environment setup needed:

```
# Skip NEON optimization (phases 1–6 + 8 only, fewer tokens):
@wos-porter https://github.com/owner/repo WOS_SKIP_OPTIMIZE=1

# Use an x64 baseline for gap-targeted NEON optimization:
@wos-porter https://github.com/owner/repo C:\x64_bench\bench_results.json
```

Or set environment variables before running:

```powershell
$env:WOS_SKIP_OPTIMIZE = '1'                          # skip Phase 7
$env:WOS_X64_BENCH = 'C:\x64_bench\bench_results.json' # x64 baseline
```

## Uninstall

```
codex plugin remove wos-porter@extension-wos-porter
codex plugin marketplace remove extension-wos-porter
```

## Output

The pipeline writes an `ARM64-PORT.md` report to the ported repo and produces a `git format-patch` series on the `arm64-port` branch.

