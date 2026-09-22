// Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
// SPDX-License-Identifier: BSD-3-Clause-Clear

// Runs via the package.json "vscode:uninstall" lifecycle hook when the
// extension is fully uninstalled. It executes as a plain Node process with
// NO access to the `vscode` API, so cleanup uses fs/path only. Keep the four
// asset lists here in sync with src/extension.ts.

const fs = require('fs');
const path = require('path');

const AGENT_FILES = [
    'wos-porter.agent.md',
    'wos-analyzer.agent.md',
    'wos-build-porter.agent.md',
    'wos-code-porter.agent.md',
    'wos-builder.agent.md',
    'wos-tester.agent.md',
    'wos-optimizer.agent.md',
    'x64-benchmarker.agent.md',
    'wos-benchmark-optimizer.agent.md',
];

const INSTRUCTION_FILES = [
    'wos-build-errors.instructions.md',
    'wos-porting-knowledge.instructions.md',
    'wos-build-recipes-cmake.instructions.md',
    'wos-build-recipes-msbuild.instructions.md',
    'wos-build-recipes-cargo.instructions.md',
    'wos-build-recipes-meson.instructions.md',
    'wos-build-recipes-nodegyp.instructions.md',
    'wos-build-recipes-python.instructions.md',
    'wos-build-recipes-misc.instructions.md',
    'wos-ci-arm64.instructions.md',
];

const SKILL_DIRS = [
    'wos-neon-reference',
    'wos-build-error-recipes',
    'wos-forbidden-skip-reasons',
    'wos-toolchain-discovery',
    'wos-woa-dashboard',
    'arm64-baseline-porting',
    'arm64-inlineasm-to-intrinsics',
    'asm-x64-to-arm64',
    'intrinsics-x64-to-arm64',
    'jit-arm64ec-virtualalloc-fix-skill',
    'sse-avx-to-neon',
];

const PROMPT_FILES = [
    'wos-verify-port.prompt.md',
];

function copilotHome() {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(home, '.copilot');
}

// Join a single path component onto a trusted base directory, guaranteeing the
// result cannot escape that base: reduce `name` to a bare basename (strips any
// `..`, nested segments, or absolute prefix), then resolve and assert the
// result stays contained within `baseDir`.
function safeJoin(baseDir, name) {
    const base = path.resolve(baseDir);
    const resolved = path.resolve(base, path.basename(name));
    const rel = path.relative(base, resolved);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`Refusing path outside base directory: ${name}`);
    }
    return resolved;
}

function tryUnlink(p) {
    try { if (fs.existsSync(p)) { fs.unlinkSync(p); } }
    catch (err) { console.error(`WoS Porter uninstall: failed to remove ${p}: ${err.message}`); }
}

function tryRmDirRecursive(p) {
    try { if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); } }
    catch (err) { console.error(`WoS Porter uninstall: failed to remove ${p}: ${err.message}`); }
}

function tryRmEmptyDir(p) {
    try { if (fs.existsSync(p) && fs.readdirSync(p).length === 0) { fs.rmdirSync(p); } }
    catch { /* non-fatal — leave in place */ }
}

try {
    const home = copilotHome();
    const agentsDst       = path.join(home, 'agents');
    const instructionsDst = path.join(home, 'instructions');
    const skillsDst       = path.join(home, 'skills');
    const promptsDst      = path.join(home, 'prompts');

    for (const f of AGENT_FILES)       { tryUnlink(safeJoin(agentsDst, f)); }
    for (const f of INSTRUCTION_FILES) { tryUnlink(safeJoin(instructionsDst, f)); }
    for (const d of SKILL_DIRS)        { tryRmDirRecursive(safeJoin(skillsDst, d)); }
    for (const f of PROMPT_FILES)      { tryUnlink(safeJoin(promptsDst, f)); }

    // Best-effort removal of empty parent directories only.
    for (const d of [agentsDst, instructionsDst, skillsDst, promptsDst]) { tryRmEmptyDir(d); }
} catch (err) {
    console.error(`WoS Porter uninstall: ${err && err.message ? err.message : err}`);
}
