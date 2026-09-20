// The first check after init writes: every check once, then a baseline for each rule that has findings.
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { executeRun } from '#cli/run/execute.ts';
import type { RunRecord } from '#types/record.ts';
import { openSession } from '#cli/run/session.ts';
import type { RunOutcome, Session } from '#types/run.ts';
import { runSideCommand } from '#cli/run/tool-runner.ts';
import type { FirstRun, ToolBaseline } from '#types/lifecycle.ts';
import { writeBaselines, isBaselineAllowed } from '#cli/run/baselines.ts';

function summaryOf(record: RunRecord): { failing: RunRecord['checks']; lines: string[] } {
    const failing = record.checks.filter((check) => check.status === 'missing' || check.status === 'error');
    return { failing, lines: failing.map((check) => `${check.check}: ${check.note ?? check.status}`) };
}

// Format, syntax and schema findings enter no baseline, so the gate fails on them until a fix run; init says so.
function unheldLines(first: FirstRun): string[] {
    const held = new Set([
        ...first.baselines.map((file) => file.check),
        ...first.toolBaselines.map((entry) => entry.check),
    ]);
    const unheld = first.record.checks.filter((check) => check.findings.length > 0 && !held.has(check.check));
    if (unheld.length === 0) return ['every other check passes'];
    const ids = [...new Set(unheld.map((check) => check.check))].toSorted((a, b) => a.localeCompare(b));
    const count = unheld.reduce((sum, check) => sum + check.findings.length, 0);
    return [
        `not held: ${String(count)} findings of ${ids.join(', ')} enter no baseline, because a fixer or a one-line edit clears them.`,
        'run gspot check --fix, read the diff, and commit it; the gate fails on these until then',
    ];
}

// A check with a baseline command (the ESLint suppressions) writes the tool's own file instead of a count file.
async function writeToolBaselines(
    session: Session,
    outcome: RunOutcome,
    only: Set<string> | undefined,
): Promise<ToolBaseline[]> {
    const written: ToolBaseline[] = [];
    for (const planned of outcome.planned) {
        const command = planned.spec.baseline_command;
        if (command === undefined || only?.has(planned.check) === false) continue;
        const result = outcome.record.checks.find(
            (check) => check.check === planned.check && check.scope === planned.scope.scope.path,
        );
        if (result === undefined || result.findings.length === 0) continue;
        await runSideCommand(session, planned, command);
        written.push({ check: planned.check, scope: planned.scope.scope.path, count: result.findings.length });
    }
    return written;
}

/**
 * Runs the checks once and writes a baseline for each check that allows one and has findings.
 * @param root the repository root
 * @param only the checks that run and may get a baseline; every check when left out. Adding a preset names the checks it brings or changes, so nothing else runs and a count that rose elsewhere stays a finding.
 * @returns the run record and the baselines written
 */
export async function firstRun(root: string, only?: Set<string>): Promise<FirstRun> {
    const session = await openSession(root);
    const outcome = await executeRun(session, {
        stage: 'all',
        skips: [],
        localSkips: session.policyFiles.local.skip,
        fix: false,
        isDryRun: false,
        noCache: true,
        ...(only === undefined ? {} : { among: only }),
    });
    const findings = outcome.record.checks.flatMap((check) => check.findings);
    const toolBaselines = await writeToolBaselines(session, outcome, only);
    const owned = new Set(toolBaselines.map((entry) => entry.check));
    const allowed = new Set(
        session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) =>
                manifest.checks
                    .filter((check) => isBaselineAllowed(check.inspection) && check.baseline_command === undefined)
                    .map((check) => check.name),
            ),
        ),
    );
    const declared = new Set(session.policyFiles.policy.checks.map((entry) => entry.name));
    const baselines = writeBaselines(
        root,
        findings,
        (check) => (allowed.has(check) || declared.has(check)) && !owned.has(check) && only?.has(check) !== false,
    );
    if (baselines.length > 0) mkdirSync(join(root, '.gspot', 'baselines'), { recursive: true });
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
        lines.push(`baseline: ${shown} enter a baseline with ${String(count)} findings`);
    }
    for (const entry of first.toolBaselines)
        lines.push(
            `baseline: ${entry.check} wrote its own suppressions file for ${String(entry.count)} findings (${entry.scope === '' ? 'root' : entry.scope})`,
        );
    const summary = summaryOf(record);
    return { lines: [...lines, ...unheldLines(first), ...summary.lines], failing: summary.failing.length };
}
