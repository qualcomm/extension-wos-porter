---
description: "Windows ARM64 recipes for less-common build systems: Autotools, Makefile / NMake, Bazel, GN, Premake, SCons, Waf, qmake, xmake, B2 (Boost.Build), Go / cgo. Auto-loaded on their marker files."
applyTo: "**/{configure,configure.ac,configure.in},**/{Makefile,GNUmakefile,makefile,NMakefile,makefile.vc},**/Makefile.am,**/{BUILD,BUILD.bazel,WORKSPACE,WORKSPACE.bazel,MODULE.bazel},**/BUILD.gn,**/.gn,**/premake5.lua,**/premake4.lua,**/SConstruct,**/SConscript,**/wscript,**/*.pro,**/*.pri,**/xmake.lua,**/Jamfile,**/Jamroot,**/Jamfile.v2,**/project-config.jam,**/user-config.jam,**/go.mod,**/*_amd64.s"
---

# Miscellaneous build systems — Windows ARM64 recipes

## Autotools (`configure.ac`)

```m4
case "$host_cpu" in
  aarch64*|arm64*)
    AC_DEFINE([TARGET_ARM64], [1], [Building for ARM64])
    target_arm64=yes ;;
  x86_64*|amd64*)
    AC_DEFINE([TARGET_X64], [1], [Building for x64])
    target_x64=yes ;;
esac
AM_CONDITIONAL([TARGET_ARM64], [test "x$target_arm64" = "xyes"])
AM_CONDITIONAL([TARGET_X64],   [test "x$target_x64"   = "xyes"])
```

`Makefile.am`:
```makefile
if TARGET_ARM64
arch_SOURCES = src/arch/arm64/impl.c
else
arch_SOURCES = src/arch/x64/impl.c
endif

if TARGET_X64
AM_CFLAGS += -msse2 -mavx2
endif
```

Cross-compile: `./configure --host=aarch64-w64-mingw32`

## Makefile (GNU) / NMake

GNU:
```makefile
ARCH ?= $(shell $(CC) -dumpmachine 2>/dev/null | grep -q aarch64 && echo arm64 || echo x64)

ifeq ($(ARCH),arm64)
    ARCH_DEFS = -DTARGET_ARM64=1
    ARCH_FLAGS =
else
    ARCH_DEFS = -DTARGET_X64=1
    ARCH_FLAGS = -msse2
endif

CFLAGS   += $(ARCH_FLAGS) $(ARCH_DEFS)
CXXFLAGS += $(ARCH_FLAGS) $(ARCH_DEFS)
BUILD_DIR = build/$(ARCH)
```

NMake (loaded under `vcvarsarm64.bat`):
```makefile
!IF "$(VSCMD_ARG_TGT_ARCH)"=="arm64"
ARCH_DEFS = /DTARGET_ARM64=1
!ELSE
ARCH_DEFS = /DTARGET_X64=1
!ENDIF
CFLAGS = $(CFLAGS) $(ARCH_DEFS)
```

Invoke: `nmake /f Makefile PLATFORM=ARM64` under vcvarsArm64.

## Bazel

Platform + `.bazelrc`:
```python
platform(
    name = "windows_arm64",
    constraint_values = ["@platforms//os:windows", "@platforms//cpu:aarch64"],
)
```
```
build:arm64 --platforms=//:windows_arm64
build:arm64 --cpu=arm64-v8a
build:arm64 --copt=/DTARGET_ARM64=1
```

`BUILD` with `config_setting` + `select()`:
```python
config_setting(name = "arm64_windows",
    constraint_values = ["@platforms//os:windows", "@platforms//cpu:aarch64"])

cc_library(
    name = "arch_impl",
    srcs = select({
        ":arm64_windows": ["src/arch/arm64/impl.c"],
        ":x64_windows":   ["src/arch/x64/impl.c"],
        "//conditions:default": ["src/arch/generic/impl.c"],
    }),
    copts = select({
        ":arm64_windows": ["/DTARGET_ARM64=1"],
        ":x64_windows":   ["/DTARGET_X64=1", "/arch:AVX2"],
    }),
)
```

Build: `bazel build //... --platforms=@platforms//cpu:aarch64`

### Bazel external repositories & load-time toolchain probes (complex monorepos: TensorFlow, gRPC, XLA)

On large projects the build dies **before any target compiles**, during WORKSPACE/MODULE load, when an external `repository_rule` eagerly probes for a toolchain and hard-`fail()`s. Canonical example (TensorFlow-transitive):

```
ERROR: .../rules_swift/swift/internal/swift_autoconfiguration.bzl:...:
  No 'swiftc.exe' executable found in Path
```

This is a **dependency-resolution** problem, not an ARM64 source issue — Swift is irrelevant to a Windows ARM64 TF build, but the repo rule runs regardless. Fixes, in order of preference:

1. **Don't load the unused rule.** In `WORKSPACE`, comment out the `swift_rules_dependencies()` / `register_toolchains("@build_bazel_rules_swift//...")` call (or the `*_configure()` that triggers it) when nothing you build depends on it. For `MODULE.bazel`, drop the `bazel_dep(name = "rules_swift")` or mark it `dev_dependency = True`.
2. **Satisfy the probe cheaply** when the rule must load. Put a no-op stub on `PATH` so the `which`-style check passes:
   ```powershell
   # stub swiftc.exe — a batch that exits 0; the rule only checks existence, never runs a real compile
   $stub = "$env:TEMP\swiftstub"; New-Item -ItemType Directory -Force $stub | Out-Null
   Set-Content "$stub\swiftc.bat" "@exit /b 0"   # or a copy of any exe named swiftc.exe
   $env:PATH = "$stub;$env:PATH"
   ```
   Same pattern for other eager probes: set the env var the rule reads (`SWIFT_HOME`, `BAZEL_SH`, `PYTHON_BIN_PATH`, `TF_NEED_CUDA=0`, `TF_NEED_ROCM=0`).
3. **Steer autodetection with `--repo_env` / `--action_env`** instead of the ambient environment (reproducible, survives `--repo_env` caching): `bazel build --repo_env=TF_NEED_CUDA=0 --repo_env=PYTHON_BIN_PATH=C:/Python-arm64/python.exe ...`.
4. **Build only the subgraph you need** so unused external repos are never fetched/configured: `bazel build //tensorflow/lite:libtensorflowlite.so` rather than `//...`. Bazel only resolves repos reachable from the requested targets — narrowing the target set is often the fastest way past a toolchain probe for a component you don't ship.

Verify what a target actually pulls in before fighting a probe: `bazel query 'deps(//your:target)' --output package` and `bazel query 'kind("repository_rule", //external:*)'`. If the failing rule is NOT in your target's dep set, option 1 or 4 removes it entirely. NEVER register an x64 toolchain to get past the probe on an ARM64 build.

## GN (Chromium / V8 / PDFium)

Args: `gn gen out/arm64 --args='target_cpu="arm64" target_os="win"'`

`BUILD.gn`:
```gn
if (target_cpu == "x64") {
  sources += [ "src/arch/x64/impl.cc" ]
  cflags  += [ "/arch:AVX2" ]
} else if (target_cpu == "arm64") {
  sources += [ "src/arch/arm64/impl.cc" ]
  defines += [ "TARGET_ARM64=1" ]
}
```

## Premake

`premake5.lua`:
```lua
workspace "MyProject"
    platforms { "x64", "ARM64" }

    filter "platforms:ARM64"
        architecture "ARM64"
        defines { "TARGET_ARM64=1" }
        removebuildoptions { "/arch:AVX", "/arch:AVX2", "/arch:SSE2" }
        files { "src/arch/arm64/**.c" }

    filter "platforms:x64"
        architecture "x86_64"
        defines { "TARGET_X64=1" }
        files { "src/arch/x64/**.c" }

    filter {}
```

## SCons

`SConstruct`:
```python
target_arch = ARGUMENTS.get('arch', os.environ.get('VSCMD_ARG_TGT_ARCH', 'x64'))
env = Environment(TARGET_ARCH=target_arch, MSVC_USE_SCRIPT=True)
if target_arch == 'arm64':
    env.Append(CPPDEFINES=['TARGET_ARM64=1'])
    x64_flags = ['/arch:SSE2','/arch:AVX','/arch:AVX2','-msse2','-mavx2']
    env['CCFLAGS'] = [f for f in env.get('CCFLAGS', []) if f not in x64_flags]
```

Invoke: `scons arch=arm64`

## Waf (`wscript`)

```python
def options(opt):
    opt.add_option('--arch', default='x64')

def configure(conf):
    if conf.options.arch == 'arm64':
        conf.env.TARGET_ARM64 = True
        conf.env.append_value('DEFINES', ['TARGET_ARM64=1'])
        conf.env.CFLAGS   = [f for f in conf.env.CFLAGS   if not f.startswith('/arch:')]
        conf.env.CXXFLAGS = [f for f in conf.env.CXXFLAGS if not f.startswith('/arch:')]
```

Invoke: `python waf configure --arch=arm64 && python waf build`

## qmake (Qt) — `.pro` file

```qmake
contains(QT_ARCH, arm64) | contains(QMAKE_TARGET.arch, arm64) {
    DEFINES  += TARGET_ARM64=1
    SOURCES  += src/arch/arm64/impl.cpp
    QMAKE_CFLAGS   -= /arch:AVX2 /arch:SSE2
    QMAKE_CXXFLAGS -= /arch:AVX2 /arch:SSE2
} else:contains(QT_ARCH, x86_64) {
    DEFINES += TARGET_X64=1
    SOURCES += src/arch/x64/impl.cpp
}
```

Invoke: `qmake -spec win32-arm64-msvc2022 CONFIG+=arm64`

## xmake

```lua
if is_arch("arm64", "arm64-v8a", "aarch64") then
    add_defines("TARGET_ARM64=1")
    add_files("src/arch/arm64/*.c")
else
    add_defines("TARGET_X64=1")
    add_files("src/arch/x64/*.c")
    add_cxflags("/arch:AVX2")
end
```

Invoke: `xmake f -a arm64 -p windows && xmake`

## B2 / Boost.Build (Jamfile)

`user-config.jam`:
```jam
using msvc : 14.3 : : <compileflags>/DTARGET_ARM64=1
                      <address-model>64
                      <architecture>arm ;
```

Invoke: `b2 toolset=msvc architecture=arm address-model=64`

## Go / cgo

`arch_arm64.go`:
```go
//go:build arm64 && windows
package mypackage

/*
#cgo CFLAGS: -DTARGET_ARM64=1
#cgo LDFLAGS: -Llib/arm64
*/
import "C"
```

`arch_amd64.go`:
```go
//go:build amd64 && windows
package mypackage
/* #cgo CFLAGS: -DTARGET_X64=1
   #cgo LDFLAGS: -Llib/x64 */
import "C"
```

`*_amd64.s` assembly files do NOT build for ARM64 — add matching `*_arm64.s` or portable Go implementations.

Build: `$env:GOARCH='arm64'; $env:GOOS='windows'; go build ./...`
