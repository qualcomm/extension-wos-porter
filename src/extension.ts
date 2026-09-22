// Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
// SPDX-License-Identifier: BSD-3-Clause-Clear

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

function copilotHome(): string {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(home, '.copilot');
}

function targetAgentsDir(): string       { return path.join(copilotHome(), 'agents'); }
function targetInstructionsDir(): string { return path.join(copilotHome(), 'instructions'); }
function targetSkillsDir(): string       { return path.join(copilotHome(), 'skills'); }
function targetPromptsDir(): string      { return path.join(copilotHome(), 'prompts'); }

// Join a single path component onto a trusted base directory, guaranteeing the
// result cannot escape that base. Two layers of defense:
//   1. Reduce `name` to a bare basename — strips any `..`, nested segments, or
//      absolute-path prefix, so a manifest entry can only ever be one component.
//   2. Resolve the result and assert it is still contained within `baseDir`.
// This is the single sanitizer every file operation below flows through; there
// is no un-validated `path.join` of a name onto a directory anywhere else.
function safeJoin(baseDir: string, name: string): string {
    const base = path.resolve(baseDir);
    const resolved = path.resolve(base, path.basename(name));
    const rel = path.relative(base, resolved);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`Refusing path outside base directory: ${name}`);
    }
    return resolved;
}

function copyFileSafe(src: string, dst: string): void {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
}

function copyDirRecursive(srcDir: string, dstDir: string): void {
    fs.mkdirSync(dstDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        // entry.name is a single directory component from readdir; route it
        // through safeJoin so the containment check applies uniformly.
        const s = safeJoin(srcDir, entry.name);
        const d = safeJoin(dstDir, entry.name);
        if (entry.isDirectory()) { copyDirRecursive(s, d); }
        else if (entry.isFile()) { copyFileSafe(s, d); }
    }
}

function installAll(context: vscode.ExtensionContext): void {
    const ext = context.extensionPath;

    // Agents
    const agentsSrc = safeJoin(ext, 'agents');
    const agentsDst = targetAgentsDir();
    fs.mkdirSync(agentsDst, { recursive: true });
    for (const f of AGENT_FILES) {
        copyFileSafe(safeJoin(agentsSrc, f), safeJoin(agentsDst, f));
    }

    // Instructions
    const instructionsSrc = safeJoin(ext, 'instructions');
    if (fs.existsSync(instructionsSrc)) {
        const instructionsDst = targetInstructionsDir();
        fs.mkdirSync(instructionsDst, { recursive: true });
        for (const f of INSTRUCTION_FILES) {
            const src = safeJoin(instructionsSrc, f);
            if (fs.existsSync(src)) { copyFileSafe(src, safeJoin(instructionsDst, f)); }
        }
    }

    // Skills (each is a directory with SKILL.md)
    const skillsSrc = safeJoin(ext, 'skills');
    if (fs.existsSync(skillsSrc)) {
        for (const d of SKILL_DIRS) {
            const src = safeJoin(skillsSrc, d);
            const dst = safeJoin(targetSkillsDir(), d);
            if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
                copyDirRecursive(src, dst);
            }
        }
    }

    // Prompts
    const promptsSrc = safeJoin(ext, 'prompts');
    if (fs.existsSync(promptsSrc)) {
        const promptsDst = targetPromptsDir();
        fs.mkdirSync(promptsDst, { recursive: true });
        for (const f of PROMPT_FILES) {
            const src = safeJoin(promptsSrc, f);
            if (fs.existsSync(src)) { copyFileSafe(src, safeJoin(promptsDst, f)); }
        }
    }
}

// Output channel is created lazily so tests / activation errors can still surface.
let _output: vscode.OutputChannel | undefined;
function output(): vscode.OutputChannel {
    if (!_output) { _output = vscode.window.createOutputChannel('WoS Porter'); }
    return _output;
}

function removeAll(): void {
    const agentsDst = targetAgentsDir();
    for (const f of AGENT_FILES) {
        const p = safeJoin(agentsDst, f);
        if (fs.existsSync(p)) {
            try { fs.unlinkSync(p); }
            catch (err) { output().appendLine(`uninstall: failed to remove ${p}: ${(err as Error).message}`); }
        }
    }
    const instructionsDst = targetInstructionsDir();
    for (const f of INSTRUCTION_FILES) {
        const p = safeJoin(instructionsDst, f);
        if (fs.existsSync(p)) {
            try { fs.unlinkSync(p); }
            catch (err) { output().appendLine(`uninstall: failed to remove ${p}: ${(err as Error).message}`); }
        }
    }
    const skillsDst = targetSkillsDir();
    for (const d of SKILL_DIRS) {
        const p = safeJoin(skillsDst, d);
        if (fs.existsSync(p)) {
            try { fs.rmSync(p, { recursive: true, force: true }); }
            catch (err) { output().appendLine(`uninstall: failed to remove ${p}: ${(err as Error).message}`); }
        }
    }
    const promptsDst = targetPromptsDir();
    for (const f of PROMPT_FILES) {
        const p = safeJoin(promptsDst, f);
        if (fs.existsSync(p)) {
            try { fs.unlinkSync(p); }
            catch (err) { output().appendLine(`uninstall: failed to remove ${p}: ${(err as Error).message}`); }
        }
    }
    for (const d of [agentsDst, instructionsDst, skillsDst, promptsDst]) {
        try { if (fs.existsSync(d) && fs.readdirSync(d).length === 0) { fs.rmdirSync(d); } }
        catch (err) { output().appendLine(`uninstall: could not remove empty dir ${d}: ${(err as Error).message}`); }
    }
}

async function updateSettingLocation(setting: string, dir: string, enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('chat');
    const current = { ...(config.get<Record<string, boolean>>(setting) || {}) };
    try {
        if (enabled) {
            if (!current[dir]) {
                current[dir] = true;
                await config.update(setting, current, vscode.ConfigurationTarget.Global);
            }
        } else {
            if (current[dir] !== undefined) {
                delete current[dir];
                await config.update(
                    setting,
                    Object.keys(current).length > 0 ? current : undefined,
                    vscode.ConfigurationTarget.Global
                );
            }
        }
    } catch (err) {
        // VS Code throws when the target key isn't registered by any installed extension
        // (typical when Copilot Chat is older than this extension or missing entirely).
        // Log once to the output channel and keep going — the other three settings and
        // the on-disk asset copy still succeed.
        const msg = err instanceof Error ? err.message : String(err);
        output().appendLine(
            `settings: skipped chat.${setting} — ${msg}. ` +
            `Install/update GitHub Copilot Chat, or add the location manually: ${dir}`
        );
    }
}

async function addToSettings(): Promise<void> {
    await updateSettingLocation('agentFilesLocations',       targetAgentsDir(),       true);
    await updateSettingLocation('instructionFilesLocations', targetInstructionsDir(), true);
    await updateSettingLocation('skillLocations',            targetSkillsDir(),       true);
    await updateSettingLocation('promptFilesLocations',      targetPromptsDir(),      true);
}

async function removeFromSettings(): Promise<void> {
    await updateSettingLocation('agentFilesLocations',       targetAgentsDir(),       false);
    await updateSettingLocation('instructionFilesLocations', targetInstructionsDir(), false);
    await updateSettingLocation('skillLocations',            targetSkillsDir(),       false);
    await updateSettingLocation('promptFilesLocations',      targetPromptsDir(),      false);
}

function countInstalled(): { agents: number; instructions: number; skills: number; prompts: number } {
    const agents       = AGENT_FILES.filter(f => fs.existsSync(safeJoin(targetAgentsDir(), f))).length;
    const instructions = INSTRUCTION_FILES.filter(f => fs.existsSync(safeJoin(targetInstructionsDir(), f))).length;
    const skills       = SKILL_DIRS.filter(d => fs.existsSync(safeJoin(targetSkillsDir(), d))).length;
    const prompts      = PROMPT_FILES.filter(f => fs.existsSync(safeJoin(targetPromptsDir(), f))).length;
    return { agents, instructions, skills, prompts };
}

// True when the on-disk asset counts match the manifest counts.
function isFullyInstalled(): boolean {
    const c = countInstalled();
    return c.agents === AGENT_FILES.length
        && c.instructions === INSTRUCTION_FILES.length
        && c.skills === SKILL_DIRS.length
        && c.prompts === PROMPT_FILES.length;
}

// Safe read of the extension's own version — never returns undefined.
function extensionVersion(context: vscode.ExtensionContext): string {
    // packageJSON is typed `any`; guard against a missing / stub package.json.
    return String(context.extension.packageJSON?.version ?? '0.0.0-unknown');
}

export async function activate(context: vscode.ExtensionContext) {
    try {
        // Copy assets on version bump OR when any expected asset is missing on disk
        // (self-heal after manual deletion — the version-guard alone would skip the copy).
        const currentVersion = extensionVersion(context);
        const installedVersion = context.globalState.get<string>('installedVersion');
        if (installedVersion !== currentVersion || !isFullyInstalled()) {
            installAll(context);
            await context.globalState.update('installedVersion', currentVersion);
            output().appendLine(`activate: installed assets for version ${currentVersion} (was ${installedVersion ?? 'none'})`);
        }
        // addToSettings handles per-setting failures internally (unregistered keys, etc.);
        // any error escaping here is a real bug — log without a modal so we don't nag the
        // user on every startup.
        await addToSettings();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        output().appendLine(`activate: ${msg}`);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('wosPorter.install', async () => {
            try {
                installAll(context);
                await addToSettings();
                await context.globalState.update('installedVersion', extensionVersion(context));
                const c = countInstalled();
                const selection = await vscode.window.showInformationMessage(
                    `WoS Porter installed: ${c.agents} agents, ${c.instructions} instructions, ${c.skills} skills, ${c.prompts} prompts (${copilotHome()})`,
                    'Reload Window'
                );
                if (selection === 'Reload Window') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`WoS Porter: ${msg}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('wosPorter.uninstall', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Remove all WoS Porter agents, instructions, skills, prompts and settings entries?',
                { modal: true },
                'Remove'
            );
            if (confirm !== 'Remove') { return; }

            removeAll();
            await removeFromSettings();
            await context.globalState.update('installedVersion', undefined);

            vscode.window.showInformationMessage(
                'WoS Porter: assets removed and settings cleaned.',
                'Reload Window'
            ).then(selection => {
                if (selection === 'Reload Window') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('wosPorter.status', () => {
            const c = countInstalled();
            vscode.window.showInformationMessage(
                `WoS Porter: ${c.agents}/${AGENT_FILES.length} agents · ${c.instructions}/${INSTRUCTION_FILES.length} instructions · ${c.skills}/${SKILL_DIRS.length} skills · ${c.prompts}/${PROMPT_FILES.length} prompts`,
                { modal: true }
            );
        })
    );
}

export function deactivate() {}
