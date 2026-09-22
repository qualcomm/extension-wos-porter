---
description: "Canonical PowerShell block that detects the Windows ARM64 build toolchain (host arch, Visual Studio path, ARM64-target cl.exe, MSBuild, dumpbin, vcvars script) and caches the result to .copilot/state/wos-toolchain.json for reuse across agents/phases. Load when any wos-* agent needs to build/validate ARM64 artifacts. Cached results survive across tool calls within a session; re-run only if the cache is missing or stale."
---

# WoS Toolchain Discovery

Every ARM64 build / dumpbin call needs the same six pieces of state: `$hostArch`, `$vsPath`, `$cl`, `$msbuild`, `$dumpbin`, `$vcvars`. Discovery is expensive (three `vswhere` invocations + a recursive `Get-ChildItem` on `VC\Tools\MSVC`). Do it once per repo and cache to `<repo>\.copilot\state\wos-toolchain.json`.

## Fast path — read the cache

```powershell
$repoPath  = '<absolute repo path>'
$statePath = Join-Path $repoPath '.copilot\state\wos-toolchain.json'
if (Test-Path $statePath) {
    $tc = Get-Content $statePath -Raw | ConvertFrom-Json
    if ((Test-Path $tc.cl) -and (Test-Path $tc.msbuild) -and (Test-Path $tc.dumpbin)) {
        $hostArch = $tc.hostArch; $vsPath = $tc.vsPath
        $cl = $tc.cl; $msbuild = $tc.msbuild; $dumpbin = $tc.dumpbin; $vcvars = $tc.vcvars
        Write-Host "Toolchain (cached): host=$hostArch  vs=$vsPath"
    }
}
```

If any variable is empty after the cache read, run the slow path below.

## Slow path — full discovery

```powershell
$hostArch = $env:PROCESSOR_ARCHITECTURE   # AMD64 or ARM64
# Correct for x64-emulated shells on Windows ARM64 (Git Bash, cmd under WoW64)
if ($hostArch -eq 'AMD64') {
    $wmiArch = (Get-WmiObject Win32_Processor | Select-Object -First 1).Architecture
    if ($wmiArch -eq 12) { $hostArch = 'ARM64' }
}
if ($hostArch -eq 'ARM64') {
    $hostDir = 'HostARM64\ARM64'; $vcvars = 'vcvarsarm64.bat';        $dumpbinHost = 'HostARM64\ARM64'
} else {
    $hostDir = 'Hostx64\arm64';   $vcvars = 'vcvarsamd64_arm64.bat';  $dumpbinHost = 'Hostx64\x64'
}

# vswhere on ARM64 host may live under Program Files (not the x86 folder)
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) { $vswhere = "${env:ProgramFiles}\Microsoft Visual Studio\Installer\vswhere.exe" }
$vsPath  = & $vswhere -latest -property installationPath

$cl = Get-ChildItem "$vsPath\VC\Tools\MSVC" -Recurse -Filter cl.exe -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match [regex]::Escape($hostDir) } |
      Select-Object -First 1 -ExpandProperty FullName

# ARM64 host fallback — allow x64-emulated toolset once, with a warning
if (-not $cl -and $hostArch -eq 'ARM64') {
    Write-Warning "Native ARM64 MSVC toolset not found. Falling back to Hostx64\arm64 (runs under x86 emulation). Install 'MSVC v143 - ARM64/ARM64EC build tools (Latest) - ARM64 host' for best performance."
    $hostDir = 'Hostx64\arm64'
    $cl = Get-ChildItem "$vsPath\VC\Tools\MSVC" -Recurse -Filter cl.exe -ErrorAction SilentlyContinue |
          Where-Object { $_.FullName -match [regex]::Escape($hostDir) } |
          Select-Object -First 1 -ExpandProperty FullName
}

$msbuild = & $vswhere -latest -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe" |
    Where-Object { if ($hostArch -eq 'ARM64') { $_ -match 'arm64' } else { $_ -notmatch 'arm64' } } |
    Select-Object -First 1
if (-not $msbuild) {
    $msbuild = & $vswhere -latest -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe" | Select-Object -First 1
}

$dumpbin = Get-ChildItem "$vsPath\VC\Tools\MSVC" -Recurse -Filter dumpbin.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match [regex]::Escape($dumpbinHost) } |
    Select-Object -First 1 -ExpandProperty FullName

$vcvarsPath = Join-Path $vsPath "VC\Auxiliary\Build\$vcvars"

Write-Host "Host:     $hostArch"
Write-Host "VS:       $vsPath"
Write-Host "cl.exe:   $cl"
Write-Host "MSBuild:  $msbuild"
Write-Host "dumpbin:  $dumpbin"
Write-Host "vcvars:   $vcvarsPath"

# Persist for reuse across phases / sub-agents
$stateDir  = Join-Path $repoPath '.copilot\state'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
# Ensure the agent's scratch state never dirties the working tree (Phase 8 G8 clean-tree gate)
# nor gets committed. Covers wos-toolchain.json, wos-deps.json, wos-milestones.json,
# optimizer-deferred.json, and any future .copilot state.
$gi = Join-Path $repoPath '.gitignore'
if (-not (Test-Path $gi) -or -not (Select-String -Path $gi -SimpleMatch '.copilot/' -Quiet)) {
    Add-Content -Path $gi -Value "`n# wos-porter agent scratch state (not part of the port)`n.copilot/"
}
[pscustomobject]@{
    hostArch = $hostArch; vsPath = $vsPath
    cl = $cl; msbuild = $msbuild; dumpbin = $dumpbin
    vcvars = $vcvarsPath; hostDir = $hostDir; dumpbinHost = $dumpbinHost
    capturedUtc = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json | Set-Content -Path (Join-Path $stateDir 'wos-toolchain.json')
```

## Verification checklist

- `$vsPath` — real directory under `Program Files\Microsoft Visual Studio\<year>\<edition>` — else BLOCKING.
- `$cl` — path ends in `$hostDir\cl.exe` — else BLOCKING (or the emulation-fallback warning above).
- `$msbuild` — file exists — else BLOCKING.
- `$dumpbin` — file exists — else BLOCKING (Phase 5/6 validation can't run without it).
- If the ARM64 native toolset is missing, WARN and recommend installing `MSVC v143 - ARM64/ARM64EC build tools (Latest) - ARM64 host`.

## Optional: also probe supporting tools

```powershell
Get-Command cmake, ninja, vcpkg, python, node, perl, git -ErrorAction SilentlyContinue |
    Select-Object Name, Source
```

On ARM64 host, warn (do not block) if any resolves to an x64-only build; recommend the ARM64 build (ARM64 Python, ARM64 Node.js, ARM64 Git for Windows, ARM64 CMake).
