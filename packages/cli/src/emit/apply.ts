// Write every generated file, block and merge; remove strays; set the hooks path. The apply command as a function.
import { dirname, join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import type { RunRecord } from '#types/record.ts';
import { computeDrift } from '#cli/emit/drift.ts';
import { locateTool } from '#cli/doctor/probes.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import type { RulesLintReport } from '#types/rules.ts';
import { lowerBaselines } from '#cli/run/baselines.ts';
import { applyBlock } from '#cli/emit/managed-blocks.ts';
import { runSideCommand } from '#cli/run/tool-runner.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { isRulePath, lintRules } from '#cli/rules/lint.ts';
import { hasPackagePins, emitAll } from '#cli/emit/targets.ts';
import { markExecutable } from '#cli/platform/executable-bit.ts';
import { openSession, everyManifest } from '#cli/run/session.ts';
import { hasPackages, installPackages } from '#cli/prose/vale.ts';
import { isLefthookHeld, usesLefthook } from '#cli/emit/lefthook.ts';
import { installHooksPath, removeHooksPath } from '#cli/emit/hooks.ts';
import type { Session, CommandResult, PlannedCheck } from '#types/run.ts';
import { assetPath, listAssets, readAsset } from '#cli/platform/assets.ts';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { ApplyReport, ApplyOptions, DriftEntry, PackageContent, RenderedSet } from '#types/emit.ts';

const WRITABLE_MODE = 0o644;
const READ_ONLY_MODE = 0o444;
const GSPOT_DIRECTORY = '.gspot/';
const RULES_PREFIX = 'rules/';
const VALE_CONFIG = 'prose/vale.ini';

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
        const merged = Object.entries({ ...content.devDependencies, ...output.devDependencies });
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
    writeFileSync(full, usesLefthook(existingText(full), lefthook.block));
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

function rulesReport(session: Session): RulesLintReport {
    const files = listAssets(RULES_PREFIX)
        .map((path) => path.slice(RULES_PREFIX.length))
        .filter((path) => isRulePath(path))
        .map((path) => ({ path, text: readAsset(`${RULES_PREFIX}${path}`) }));
    const config = assetPath(VALE_CONFIG);
    const binary = locateTool(session.root, 'vale');
    const vale = config === undefined || binary === undefined ? {} : { vale: { binary, config } };
    return lintRules(files, vale, session.root);
}

function rulesText(report: RulesLintReport): string {
    const lines = report.findings.map((finding) => `  ${finding.file}:${String(finding.line)}  ${finding.message}`);
    const vale = report.isValeRun ? '' : ' (vale is not installed; prose rules skipped)';
    const summary = `rule corpus: ${String(report.files)} files${vale}`;
    return `${[...lines, summary].join('\n')}\n`;
}

function checkDrift(session: Session): CommandResult {
    const drift = computeDrift(session);
    const rules = rulesReport(session);
    const json = {
        drift,
        rules: { findings: rules.findings, files: rules.files, isValeRun: rules.isValeRun },
    };
    const driftLine = drift.length === 0 ? 'every generated file matches its render\n' : driftText(drift);
    const exitCode = drift.length === 0 && rules.findings.length === 0 ? 0 : 1;
    return { text: `${driftLine}${rulesText(rules)}`, json, exitCode };
}

async function pruneOne(session: Session, check: PlannedCheck): Promise<string | undefined> {
    const { spec, scope } = check;
    if (spec.prune_command === undefined || spec.baseline_file === undefined) return undefined;
    const file = join(session.root, spec.baseline_file);
    if (!existsSync(file)) return undefined;
    await runSideCommand(session, check, spec.prune_command);
    if (Object.keys(JSON.parse(readFileSync(file, 'utf8')) as object).length === 0) rmSync(file, { force: true });
    const where = scope.scope.path === '' ? '' : ` (${scope.scope.path})`;
    return `${check.id}${where}`;
}

// A tool that owns its baseline prunes it itself: ESLint drops the suppressions nothing triggers any more.
async function pruneToolBaselines(session: Session): Promise<string[]> {
    const pruned: string[] = [];
    const planned = planRun(session, { stage: 'all', skips: [], localSkips: session.policyFiles.local.skip });
    for (const check of planned) {
        const name = await pruneOne(session, check);
        if (name !== undefined) pruned.push(name);
    }
    return pruned;
}

async function lowerFromLastRun(root: string, session: Session): Promise<CommandResult> {
    const last = join(root, '.gspot', 'last.json');
    if (!existsSync(last))
        return {
            text: 'There is no last run to read. Run gspot check first.\n',
            json: { error: 'no-last-run' },
            exitCode: 2,
        };
    const record = JSON.parse(readFileSync(last, 'utf8')) as RunRecord;
    const findings = record.checks.flatMap((check) => check.findings);
    const existing = new Set([
        ...everyManifest(session).flatMap((manifest) => manifest.checks.map((check) => check.id)),
        ...session.policyFiles.policy.checks.map((check) => check.id),
    ]);
    const result = lowerBaselines(root, findings, existing);
    const pruned = await pruneToolBaselines(session);
    const lines = [
        ...pruned.map((id) => `pruned   ${id}  (the tool's own suppressions file)`),
        ...result.lowered.map((id) => `lowered  ${id}`),
        ...result.removed.map((id) => `removed  ${id}`),
        ...result.rose.map(
            (id) => `rose     ${id}  (a baseline never rises; fix the findings or add an ignore with a reason)`,
        ),
    ];
    const text = lines.length === 0 ? "every baseline is already at the last run's count" : lines.join('\n');
    return { text: `${text}\n`, json: { ...result, pruned }, exitCode: result.rose.length > 0 ? 1 : 0 };
}

async function installProsePackages(session: Session, report: ApplyReport): Promise<void> {
    const isProse = session.scopes.some((selection) =>
        selection.selected.some((manifest) => manifest.preset.id === 'prose'),
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
 * @param binaryPath the gspot binary the hooks call, when not on PATH
 * @returns what was written, unchanged, removed, and which blocks and packages changed
 */
export async function applyAll(session: Session, binaryPath?: string): Promise<ApplyReport> {
    const report: ApplyReport = { written: [], unchanged: [], removed: [], blocks: [], packages: [], notes: [] };
    const drift = computeDrift(session);
    const rendered = emitAll(session, binaryPath);
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
    if (hasGit && session.policyFiles.policy.hooks.tool === 'gspot') installHooksPath(session.root);
    else if (hasGit) removeHooksPath(session.root);
    await installProsePackages(session, report);
    return report;
}

/**
 * Runs apply: `--check` reports drift, `--baseline` lowers the baselines to the last run, otherwise everything is written.
 * @param options the parsed flags
 * @returns the command result
 */
export async function applyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertPinMatches(root);
    const session = await openSession(root);
    if (options.check) return checkDrift(session);
    if (options.baseline) return lowerFromLastRun(root, session);
    const report = await applyAll(session, options.binaryPath);
    return { text: reportText(report), json: report, exitCode: 0 };
}
