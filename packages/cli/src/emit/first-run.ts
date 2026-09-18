// After init writes: the package.json pins, the tool install, the first check run and its baselines.
import { join } from 'node:path';
import { detectPackageManager } from 'nypm';
import { run } from '#cli/platform/spawn.ts';
import { existsSync, mkdirSync } from 'node:fs';
import { executeRun } from '#cli/run/execute.ts';
import type { RunRecord } from '#types/record.ts';
import { openSession } from '#cli/run/session.ts';
import type { Manifest } from '#types/manifest.ts';
import type { RunOutcome, Session } from '#types/run.ts';
import { runSideCommand } from '#cli/run/tool-runner.ts';
import { npmPins, npmScripts } from '#cli/emit/runner-surface.ts';
import { writeBaselines, isBaselineAllowed } from '#cli/run/baselines.ts';
import type { ApplyReport, FirstRun, InitAnswers, PackageContent, ToolBaseline } from '#types/emit.ts';

const PACKAGE_RUNNERS = new Set(['bun', 'npm', 'pnpm']);

function installCommands(runner: InitAnswers['runner']): string[][] {
    if (runner === 'mise') return [['mise', 'install']];
    if (runner === 'uv') return [['uv', 'apply', '--group', 'gspot']];
    return [[runner, 'install']];
}

async function runInstall(root: string, commands: string[][]): Promise<string> {
    const notes: string[] = [];
    for (const command of commands) {
        const result = await run(command, { cwd: root });
        const shown = command.join(' ');
        notes.push(
            result.code === 0
                ? `ran ${shown}`
                : `${shown} failed (exit ${String(result.code)}); gspot doctor names what is missing`,
        );
    }
    return notes.join('; ');
}

function summaryOf(record: RunRecord): { failing: RunRecord['checks']; lines: string[] } {
    const failing = record.checks.filter((check) => check.status === 'missing' || check.status === 'error');
    return { failing, lines: failing.map((check) => `${check.id}: ${check.note ?? check.status}`) };
}

// A check with a baseline command (the ESLint suppressions) writes the tool's own file instead of a count file.
async function writeToolBaselines(session: Session, outcome: RunOutcome): Promise<ToolBaseline[]> {
    const written: ToolBaseline[] = [];
    for (const planned of outcome.planned) {
        const command = planned.spec.baseline_command;
        if (command === undefined) continue;
        const result = outcome.record.checks.find(
            (check) => check.id === planned.id && check.scope === planned.scope.scope.path,
        );
        if (result === undefined || result.findings.length === 0) continue;
        await runSideCommand(session, planned, command);
        written.push({ check: planned.id, scope: planned.scope.scope.path, count: result.findings.length });
    }
    return written;
}

/**
 * Adds the pinned devDependencies and the gspot scripts to package.json, creating the file when there is none.
 * @param root the repository root
 * @param runner the runner surface chosen
 * @param everySelected every selected manifest
 */
export async function updatePackageJson(
    root: string,
    runner: InitAnswers['runner'],
    everySelected: Manifest[],
): Promise<void> {
    if (!PACKAGE_RUNNERS.has(runner)) return;
    const { default: manifestEditor } = await import('@npmcli/package-json');
    const manifest = existsSync(join(root, 'package.json'))
        ? await manifestEditor.load(root)
        : await manifestEditor.create(root);
    const current = manifest.content as PackageContent;
    manifest.update({
        devDependencies: { ...current.devDependencies, ...npmPins(everySelected, runner) },
        scripts: { ...current.scripts, ...npmScripts() },
    });
    await manifest.save();
}

/**
 * Installs the pinned tools through the runner surface, or says how to when --no-install was given.
 * @param root the repository root
 * @param runner the runner surface chosen
 * @param synced what apply wrote, for the package manager step mise needs
 * @param isInstalling whether init was asked to install
 * @returns the note for the summary, empty when there is no runner
 */
export async function installTools(
    root: string,
    runner: InitAnswers['runner'],
    synced: ApplyReport,
    isInstalling: boolean,
): Promise<string> {
    if (runner === 'none') return '';
    if (!isInstalling) {
        const command = runner === 'mise' ? 'mise install' : `${runner} install`;
        return `install skipped; run: ${command}`;
    }
    const commands = installCommands(runner);
    if (runner === 'mise') {
        await run(['mise', 'trust', '.config/mise/conf.d/gspot.toml'], { cwd: root });
        if (synced.packages.length > 0) {
            const detected = await detectPackageManager(root);
            commands.push([detected?.name ?? 'npm', 'install']);
        }
    }
    return runInstall(root, commands);
}

/**
 * Runs every check once and writes a baseline for each check that allows one and has findings.
 * @param root the repository root
 * @returns the run record and the baselines written
 */
export async function firstRun(root: string): Promise<FirstRun> {
    const session = await openSession(root);
    const outcome = await executeRun(session, {
        stage: 'all',
        skips: [],
        localSkips: session.policyFiles.local.skip,
        fix: false,
        isDryRun: false,
        noCache: true,
    });
    const findings = outcome.record.checks.flatMap((check) => check.findings);
    const toolBaselines = await writeToolBaselines(session, outcome);
    const owned = new Set(toolBaselines.map((entry) => entry.check));
    const allowed = new Set(
        session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) =>
                manifest.checks
                    .filter((check) => isBaselineAllowed(check.inspection) && check.baseline_command === undefined)
                    .map((check) => check.id),
            ),
        ),
    );
    const declared = new Set(session.policyFiles.policy.checks.map((entry) => entry.id));
    const baselines = writeBaselines(
        root,
        findings,
        (check) => (allowed.has(check) || declared.has(check)) && !owned.has(check),
    );
    if (baselines.length > 0) mkdirSync(join(root, '.gspot', 'baseline'), { recursive: true });
    return { record: outcome.record, baselines, toolBaselines };
}

/**
 * The lines init prints after the first run: what was written, the install note, the baselines, the checks that did not run.
 * @param first the first run
 * @param installNote what the install step did
 * @returns the lines and how many checks are missing a tool or broke
 */
export function firstRunSummary(first: FirstRun, installNote: string): { lines: string[]; failing: number } {
    const { record, baselines } = first;
    const lines = ['', `written: gspot.toml, .gspot/ (${String(record.checks.length)} checks ran)`];
    if (installNote !== '') lines.push(installNote);
    if (baselines.length === 0) lines.push('baseline: every check passes; none needed');
    else {
        const noun = baselines.length === 1 ? 'rule' : 'rules';
        const count = baselines.reduce((sum, file) => sum + file.count, 0);
        const shown = `${String(baselines.length)} ${noun}`;
        lines.push(`baseline: ${shown} enter a baseline with ${String(count)} findings; every other check passes`);
    }
    for (const entry of first.toolBaselines)
        lines.push(
            `baseline: ${entry.check} wrote its own suppressions file for ${String(entry.count)} findings (${entry.scope === '' ? 'root' : entry.scope})`,
        );
    const summary = summaryOf(record);
    return { lines: [...lines, ...summary.lines], failing: summary.failing.length };
}
