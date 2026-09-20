// Write every generated file, block and merge; remove strays; set the hooks path. The apply command as a function.
import { dirname, join } from 'node:path';
import { computeDrift } from '#cli/emit/drift.ts';
import { openSession } from '#cli/run/session.ts';
import { mergedPins } from '#cli/emit/kept-pins.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { installHooksPath } from '#cli/emit/hooks.ts';
import { applyBlock } from '#cli/emit/managed-blocks.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import type { Session, CommandResult } from '#types/run.ts';
import { firstBaseline } from '#cli/emit/first-baseline.ts';
import { hasPackagePins, emitAll } from '#cli/emit/targets.ts';
import { lowerFromLastRun } from '#cli/emit/lower-baselines.ts';
import { markExecutable } from '#cli/platform/executable-bit.ts';
import { hasPackages, installPackages } from '#cli/prose/vale.ts';
import { isLefthookHeld, lefthookText } from '#cli/emit/lefthook.ts';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { ApplyReport, ApplyOptions, DriftEntry, PackageContent, RenderedSet } from '#types/emit.ts';

const WRITABLE_MODE = 0o644;
const READ_ONLY_MODE = 0o444;
const GSPOT_DIRECTORY = '.gspot/';

function existingText(full: string): string {
    return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

function writeFiles(session: Session, rendered: RenderedSet, report: ApplyReport): void {
    for (const file of rendered.files) {
        const isChanged = didWrite(session.root, file.path, file.content, file.readOnly);
        if (file.executable === true) markExecutable(session.root, file.path);
        (isChanged ? report.written : report.unchanged).push(file.path);
    }
}

function writeBlocks(session: Session, rendered: RenderedSet, report: ApplyReport): void {
    for (const block of rendered.blocks) {
        const full = join(session.root, block.path);
        const existing = existingText(full);
        const next = applyBlock(existing, block.block, block.style);
        if (next === existing) continue;
        writeFileSync(full, next);
        report.blocks.push(block.path);
    }
}

function writeMerges(session: Session, rendered: RenderedSet, report: ApplyReport): void {
    for (const merge of rendered.merges) {
        const full = join(session.root, merge.path);
        if (existingText(full) === merge.content) continue;
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, merge.content);
        report.written.push(merge.path);
    }
}

async function writePackages(session: Session, rendered: RenderedSet, report: ApplyReport): Promise<void> {
    for (const output of rendered.packages) {
        if (hasPackagePins(session.root, output)) continue;
        const { default: manifestEditor } = await import('@npmcli/package-json');
        const manifest = await manifestEditor.load(session.root);
        const content = manifest.content as PackageContent;
        const merged = Object.entries(mergedPins(content.devDependencies, output.devDependencies));
        const devDependencies = Object.fromEntries(merged.toSorted(([a], [b]) => a.localeCompare(b)));
        const scripts =
            Object.keys(output.scripts).length > 0 ? { ...content.scripts, ...output.scripts } : content.scripts;
        manifest.update({ devDependencies, ...(scripts ? { scripts } : {}) });
        await manifest.save();
        report.packages.push(output.path);
    }
}

function writeLefthook(session: Session, rendered: RenderedSet, report: ApplyReport): void {
    const { lefthook } = rendered;
    if (!lefthook || isLefthookHeld(session.root, lefthook.path, lefthook.block)) return;
    const full = join(session.root, lefthook.path);
    writeFileSync(full, lefthookText(existingText(full), lefthook.block));
    report.written.push(lefthook.path);
}

function driftText(drift: DriftEntry[]): string {
    const noun = drift.length === 1 ? 'file' : 'files';
    const lines = [`${String(drift.length)} generated ${noun} drifted:`, ''];
    for (const entry of drift) {
        lines.push(`  ${entry.path}  ${entry.kind}`);
        if (entry.diff !== undefined && entry.diff !== '')
            lines.push(
                entry.diff
                    .split('\n')
                    .map((line) => `    ${line}`)
                    .join('\n'),
            );
    }
    lines.push(
        '',
        'Two ways forward: move the change into gspot.toml (gspot set, allow, ignore), or run gspot apply to discard it.',
    );
    return `${lines.join('\n')}\n`;
}

function checkDrift(session: Session): CommandResult {
    const drift = computeDrift(session);
    const text = drift.length === 0 ? 'every generated file matches its render\n' : driftText(drift);
    return { text, json: { drift }, exitCode: drift.length === 0 ? 0 : 1 };
}

async function installProsePackages(session: Session, report: ApplyReport): Promise<void> {
    const isProse = session.scopes.some((selection) =>
        selection.selected.some((manifest) => manifest.preset.name === 'prose'),
    );
    if (!isProse || hasPackages(session.root)) return;
    const problem = await installPackages(session.root);
    if (problem === undefined) report.notes.push('synced the Vale packages into .gspot/vale/styles');
    else report.notes.push(`the Vale packages are not synced (${problem}); run gspot apply with the network on`);
}

function reportText(report: ApplyReport): string {
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.blocks.map((path) => `block    ${path}`),
        ...report.packages.map((path) => `pinned   ${path} (run your package manager's install)`),
        ...report.removed.map((path) => `removed  ${path}`),
        ...report.notes.map((note) => `note     ${note}`),
    ];
    if (lines.length === 0) lines.push(`everything up to date (${String(report.unchanged.length)} files)`);
    return `${lines.join('\n')}\n`;
}

/**
 * Writes one file, read-only where asked, creating directories.
 * @param root the repository root
 * @param path the file, relative to the root
 * @param content the text to write
 * @param isReadOnly whether the file gets mode 444 afterwards
 * @returns whether the file changed
 */
export function didWrite(root: string, path: string, content: string, isReadOnly: boolean): boolean {
    const full = join(root, path);
    if (existsSync(full)) {
        if (readFileSync(full, 'utf8') === content) return false;
        if (process.platform !== 'win32') chmodSync(full, WRITABLE_MODE);
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    if (isReadOnly && process.platform !== 'win32') chmodSync(full, READ_ONLY_MODE);
    return true;
}

/**
 * Renders and writes everything. Idempotent.
 * @param session the session
 * @returns what was written, unchanged, removed, and which blocks and packages changed
 */
export async function applyAll(session: Session): Promise<ApplyReport> {
    const report: ApplyReport = { written: [], unchanged: [], removed: [], blocks: [], packages: [], notes: [] };
    const drift = computeDrift(session);
    const rendered = emitAll(session);
    writeFiles(session, rendered, report);
    writeBlocks(session, rendered, report);
    writeMerges(session, rendered, report);
    await writePackages(session, rendered, report);
    writeLefthook(session, rendered, report);
    for (const entry of drift) {
        if (entry.kind !== 'stray' || !entry.path.startsWith(GSPOT_DIRECTORY)) continue;
        rmSync(join(session.root, entry.path), { force: true });
        report.removed.push(entry.path);
    }
    const { hasGit } = session.repository;
    if (hasGit && session.policyFiles.policy.hooks?.tool === 'gspot') installHooksPath(session.root);
    await installProsePackages(session, report);
    return report;
}

/**
 * Runs apply: `--check` reports drift, `--lower-baselines` lowers the baselines to the last run, otherwise everything is written.
 * @param options the parsed flags
 * @returns the command result
 */
export async function applyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    if (options.check) return checkDrift(session);
    if (options.lowerBaselines) return lowerFromLastRun(root, session);
    if (options.baseline !== undefined) return firstBaseline(session, options.baseline);
    const report = await applyAll(session);
    return { text: reportText(report), json: report, exitCode: 0 };
}
