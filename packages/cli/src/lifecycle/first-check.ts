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
        lines.push(`baseline: ${shown} enter a baseline with ${String(count)} findings; every other check passes`);
    }
    for (const entry of first.toolBaselines)
        lines.push(
            `baseline: ${entry.check} wrote its own suppressions file for ${String(entry.count)} findings (${entry.scope === '' ? 'root' : entry.scope})`,
        );
    const summary = summaryOf(record);
    return { lines: [...lines, ...summary.lines], failing: summary.failing.length };
}
