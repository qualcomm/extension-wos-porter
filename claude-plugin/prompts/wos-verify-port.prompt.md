---
description: "Windows ARM64 port verification gate (Phase 8 of wos-porter). Re-derives toolchain state, runs semantic gates G1–G8 against the repo on disk, and re-invokes sub-agents on failures. Never trusts sub-agent text alone."
argument-hint: "<repoName>"
---

# `/wos-verify-port <repoName>`

Verify a `wos-porter` run against the filesystem before writing the ARM64-PORT.md report. Sub-agent text is never trusted at face value — every claim is re-checked here.

## Setup — re-derive state (shell does NOT persist between calls)

Load the [wos-toolchain-discovery](../skills/wos-toolchain-discovery/SKILL.md) skill first and populate `$hostArch`, `$cl`, `$msbuild`, `$dumpbin`, `$vcvars` from `<repo>\.copilot\state\wos-toolchain.json` (fast path) or by rerunning discovery.

Paste the verbatim `wos-tester` and `wos-optimizer` reports from Phase 6 / Phase 7 into `$testerReport` and `$optimizerReport` here-strings.

```powershell
# NOTE: `$ARGUMENTS` here is a prompt-template placeholder that the runtime
# (Copilot Chat / Claude Code) substitutes BEFORE the block is executed by
# PowerShell. Single quotes intentionally suppress PowerShell's own variable
# expansion so a literal `$ARGUMENTS` reaches the substitution step. Do NOT
# copy-paste this block directly into a terminal — invoke it via
# `/wos-verify-port <repoName>`.
$repoName    = '$ARGUMENTS'
$workRoot    = if ($env:WOS_PORTER_WORKDIR) { $env:WOS_PORTER_WORKDIR }
               elseif ($IsWindows -or $env:OS -eq 'Windows_NT') { 'C:\src\wos-porter' }
               else { Join-Path $HOME 'wos-porter' }
$repoPath    = Join-Path $workRoot $repoName
Set-Location $repoPath

$testerReport    = @'
<wos-tester final report text>
'@
$optimizerReport = @'
<wos-optimizer final report text, or empty if Phase 7 was skipped>
'@

$gateFailures = @()
```

## Gates

### G1 — repo cloned and on `arm64-port`
```powershell
if (-not (Test-Path .git)) { $gateFailures += 'G1: not a git repo' }
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'arm64-port') { $gateFailures += "G1: on branch '$branch', expected 'arm64-port'" }
```

### G2 — toolchain located
```powershell
if (-not $cl      -or -not (Test-Path $cl))      { $gateFailures += "G2: \$cl invalid: '$cl'" }
if (-not $msbuild -or -not (Test-Path $msbuild)) { $gateFailures += "G2: \$msbuild missing: '$msbuild'" }
if (-not $dumpbin -or -not (Test-Path $dumpbin)) { $gateFailures += "G2: \$dumpbin missing: '$dumpbin'" }
```

### G3 — ≥1 ARM64 binary on disk with `AA64` machine
```powershell
$builtBins = Get-ChildItem -Recurse -Include *.exe,*.dll -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\\.git\\|\\node_modules\\|\\third_party\\prebuilt' -and
                   $_.LastWriteTime -gt (Get-Date).AddHours(-2) }
if (-not $builtBins) { $gateFailures += 'G3: no .exe/.dll built in the last 2 hours' }
else {
    $nonArm64 = @()
    foreach ($b in $builtBins) {
        $machine = & $dumpbin /HEADERS $b.FullName 2>&1 | Select-String 'machine \(' | Select-Object -First 1
        if ($machine -notmatch 'AA64|ARM64') { $nonArm64 += "$($b.Name): $machine" }
    }
    if ($nonArm64) { $gateFailures += "G3: non-ARM64 binaries: $($nonArm64 -join '; ')" }
}
```

### G4 — commits actually landed on `arm64-port`
```powershell
$commitCount = (git log --oneline main..arm64-port 2>$null | Measure-Object).Count
if ($commitCount -lt 1) {
    $gateFailures += "G4: zero commits on arm64-port vs main; sub-agents claimed changes but none committed"
}
```

### G5 — tester report has numeric counts or a valid skip reason
```powershell
if ($testerReport -notmatch 'Passed:\s*\d+' -or $testerReport -notmatch 'Failed:\s*\d+') {
    if ($testerReport -notmatch 'cross-compiled|host is (AMD64|x64)|no tests discovered') {
        $gateFailures += 'G5: wos-tester report lacks numeric pass/fail counts AND lacks a recognized skip reason'
    }
}
```

### G6 — benchmark file exists on ARM64 host
```powershell
$benchFile = Get-ChildItem benchmarks\base_bench_win_arm.* -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $benchFile -and $hostArch -eq 'ARM64' -and $testerReport -notmatch 'No benchmark targets|no benchmarks discovered') {
    $gateFailures += 'G6: ARM64 host but no benchmarks\base_bench_win_arm.* on disk'
}
```

### G7 — optimizer commits match claimed counts
```powershell
# Phase 7 runs ONE of two optimizers: wos-optimizer (default) OR wos-benchmark-optimizer (differential, when an x64 benchmark was supplied).
# Both commit with a 'NEON' message prefix — wos-optimizer uses 'NEON:', wos-benchmark-optimizer uses 'NEON(gap):' — so one --grep '^NEON' matches both.
if ($optimizerReport -match 'Functions optimized.*?Tier A.*?(\d+)') { $claimedA = [int]$Matches[1] }
elseif ($optimizerReport -match 'Functions optimized\s*[:\|].*?(\d+)') { $claimedA = [int]$Matches[1] }
else { $claimedA = 0 }
if ($optimizerReport -match 'Tier-S translations.*?(\d+)\s*(?:file|entr)') { $claimedS = [int]$Matches[1] } else { $claimedS = 0 }
$claimed = $claimedA + $claimedS
$neonCommits = (git log --oneline main..arm64-port --grep '^NEON' 2>$null | Measure-Object).Count
# Terminal skip/no-op outcomes that are valid for EITHER optimizer (differential agent uses the phrasings from its "When NOT to optimize" list).
$validNoop = 'No high-confidence|Skipped|No x64 benchmark supplied|No Matched benchmark pairs|at-parity or ARM64-ahead|Partial —'
if ($claimed -gt 0 -and $neonCommits -lt $claimed) {
    $gateFailures += "G7: optimizer claimed $claimed (A=$claimedA, S=$claimedS) but only $neonCommits 'NEON'-prefixed commits"
} elseif ($claimed -eq 0 -and $neonCommits -eq 0 -and $optimizerReport -notmatch $validNoop) {
    # Only a failure when there is NEITHER a parsed claim count, NOR any NEON-prefixed commit, NOR a valid no-op outcome.
    # wos-benchmark-optimizer's "Functions optimized" table has no leading count for the regex to capture, so a successful
    # differential run yields $claimed=0 but $neonCommits>0 — that must NOT be flagged; the commits prove work landed.
    $gateFailures += 'G7: optimizer report neither claims optimizations, lands any NEON commit, nor explicitly skips'
}
```

### G7b — every SSE-heavy TU either optimized or explicitly skipped
```powershell
$sseFiles = Get-ChildItem -Recurse -Include *_sse.cpp,*_sse2.cpp,*_ssse3.cpp,*_sse41.cpp,*_simd.cpp,*_avx.cpp,*_avx2.cpp -ErrorAction SilentlyContinue |
  ForEach-Object {
    $hits = (Select-String -Path $_.FullName -Pattern '_mm_|__m128|__m256' -SimpleMatch -ErrorAction SilentlyContinue).Count
    if ($hits -ge 20) { $_ }
  }
foreach ($f in $sseFiles) {
    $name = Split-Path $f.FullName -Leaf
    $inCommit   = (git log --oneline main..arm64-port -- $f.FullName 2>$null | Measure-Object).Count -gt 0
    $inSkipList = $optimizerReport -match [regex]::Escape($name)
    if (-not $inCommit -and -not $inSkipList) {
        $gateFailures += "G7b: SSE-heavy TU '$name' neither optimized nor mentioned in optimizer skip list"
    }
}
```

### G7c — forbidden skip-reason audit
Load the [wos-forbidden-skip-reasons](../skills/wos-forbidden-skip-reasons/SKILL.md) skill for the canonical `$forbiddenPatterns` regex list and evidence rules, then:

```powershell
$artifactsToScan = @($optimizerReport)
if (Test-Path 'ARM64-PORT.md') { $artifactsToScan += (Get-Content 'ARM64-PORT.md' -Raw) }
foreach ($text in $artifactsToScan) {
    foreach ($p in $forbiddenPatterns) {
        if ($text -match $p) {
            $gateFailures += "G7c: forbidden skip-reason pattern '$p' — re-invoke optimizer"
        }
    }
}
```

### G8 — working tree clean
```powershell
$dirty = git status --porcelain
if ($dirty) { $gateFailures += "G8: working tree dirty: $($dirty -join '; ')" }
```

## Result

```powershell
if ($gateFailures) {
    Write-Host "GATE FAILURES:`n - $($gateFailures -join "`n - ")" -ForegroundColor Red
    # For each G# failure, re-invoke the corresponding sub-agent with a prompt
    # that NAMES the gap. Do NOT proceed to the ARM64-PORT.md report.
} else {
    Write-Host "All semantic gates passed — proceed to ARM64-PORT.md." -ForegroundColor Green
}
```

## Anti-fabrication rules

- Every dumpbin line in the final report MUST come from running dumpbin in the block above — not copy-pasted from a sub-agent.
- Every test count MUST be re-extractable from a file on disk OR be the explicit "skipped — cross-compile" string.
- Every benchmark value MUST resolve to a real entry inside `benchmarks/base_bench_win_arm.*`.
- Every commit hash cited MUST appear in `git log --oneline main..arm64-port`.
