// apply --baseline: the first baseline of one check that starts to work after init, such as one whose tool was missing that day.
import { executeRun } from '#cli/run/execute.ts';
import { runSideCommand } from '#cli/run/tool-runner.ts';
import type { CommandResult, Session } from '#types/run.ts';
import { isBaselineAllowed, readBaselines, writeBaselines } from '#cli/run/baselines.ts';

function refusal(text: string): CommandResult {
    return { text: `${text}\n`, json: { baselines: [], refused: text }, exitCode: 2 };
}

/**
 * Runs one check and writes a baseline for each of its rules that has findings and no baseline yet. It never raises a baseline.
 * @param session the session
 * @param check the check id
 * @returns the command result
 */
export async function firstBaseline(session: Session, check: string): Promise<CommandResult> {
    const outcome = await executeRun(session, {
        stage: 'all',
        only: [check],
        skips: [],
        localSkips: [],
        fix: false,
        isDryRun: false,
        noCache: true,
    });
    const planned = outcome.planned.filter((entry) => entry.check === check);
    const [first] = planned;
    if (first === undefined) return refusal(`No selected preset runs a check called \`${check}\`.`);
    if (!isBaselineAllowed(first.spec.coverage))
        return refusal(
            `The findings of ${check} enter no baseline: a fixer or an edit clears them. Run gspot check --fix.`,
        );
    const broken = outcome.report.checks.find(
        (entry) => entry.check === check && (entry.status === 'error' || entry.status === 'missing'),
    );
    if (broken !== undefined)
        return refusal(
            `${check} did not run: ${broken.note ?? broken.status}. A baseline of a broken run holds nothing.`,
        );
    if (first.spec.baseline_command !== undefined) {
        for (const entry of planned) await runSideCommand(session, entry, first.spec.baseline_command);
        return { text: `${check} wrote its own baseline file.\n`, json: { baselines: [check] }, exitCode: 0 };
    }
    const held = new Set(readBaselines(session.root).map((file) => `${file.check}\n${file.rule}`));
    const findings = outcome.report.checks
        .flatMap((entry) => entry.findings)
        .filter((finding) => !held.has(`${finding.check}\n${finding.rule ?? 'all'}`));
    const written = writeBaselines(session.root, findings, (id) => id === check);
    const count = written.reduce((sum, file) => sum + file.count, 0);
    const text =
        written.length === 0
            ? `${check} has no finding without a baseline.`
            : `baseline: ${String(written.length)} rules of ${check} with ${String(count)} findings`;
    return { text: `${text}\n`, json: { baselines: written }, exitCode: 0 };
}
