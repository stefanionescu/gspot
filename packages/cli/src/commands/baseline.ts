import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText } from '#cli/system/files/reads.ts';
import { parseCheckNames } from '#cli/commands/edits.ts';
import { runEveryCheck } from '#cli/generation/checks.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { assertCheckExists } from '#cli/manifests/read.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { BASELINE_FILE } from '#cli/config/repository/files.ts';
import { formatCount, formatNameList } from '#cli/system/text.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import type { CommandDefinition } from '#cli/types/commands/edits.ts';
import type { CheckResult, BaselineCount } from '#cli/types/engine/run.ts';
import type { BaselineJson, BaselineFlags } from '#cli/types/commands/reports.ts';
import { BASELINE_STAGES, INCOMPLETE_STATUSES, BASELINE_EXEMPT_CHECK } from '#cli/config/engine.ts';
import { pruneCounts, parseBaseline, countFindings, formatBaseline } from '#cli/engine/baseline.ts';

import {
    PRUNE_FLAG,
    ONLY_OPTION,
    NO_BASELINE_MESSAGE,
    BASELINE_STOPPED_MESSAGE,
    BASELINE_LEFT_OUT_MESSAGE,
} from '#cli/config/commands/reports.ts';

function formatStoppedChecks(checks: readonly CheckResult[]): string {
    const causes = checks.map(({ check, note }) => {
        const cause = note?.split('\n', 1).join('') ?? '';
        return cause === '' ? `  ${check}` : `  ${check}: ${cause}`;
    });
    const names = formatNameList([...new Set(checks.map(({ check }) => check))]);
    return `gspot baseline needs every check to run, and ${names} could not:\n${[...new Set(causes)].join('\n')}`;
}

function sumCounts(counts: BaselineCount[]): { findings: number; files: number } {
    const findings = counts.reduce((total, { count }) => total + count, 0);
    const files = new Set(counts.map(({ file }) => file)).size;
    return { findings, files };
}

function countEveryCheck(checks: readonly CheckResult[]): BaselineCount[] {
    const stopped = checks.filter(({ status }) => INCOMPLETE_STATUSES.has(status));
    if (stopped.length > 0) throw new GspotError('tool', formatStoppedChecks(stopped));
    return countFindings(checks);
}

/**
Lower the counts of the checks that ran to what they found. A check that did not run keeps its counts, because a prune
only lowers counts, so offline and in a sandbox it still drops the counts that the other checks did not find.

@param previous the committed counts.
@param checks the results of the run.
@returns the remaining counts, and the sentence that names the checks that did not run.
*/
function pruneBaseline(
    previous: BaselineCount[],
    checks: readonly CheckResult[],
): { counts: BaselineCount[]; note: string } {
    const kept = new Set(checks.filter(({ status }) => INCOMPLETE_STATUSES.has(status)).map(({ check }) => check));
    const counts = [
        ...previous.filter(({ check }) => kept.has(check)),
        ...pruneCounts(
            previous.filter(({ check }) => !kept.has(check)),
            countFindings(checks),
        ),
    ];
    const note = kept.size === 0 ? '' : ` It keeps the counts of ${formatNameList([...kept])}, which did not run.`;
    return { counts, note };
}

/**
Refuse a check that --only names when no run of gspot check counts its findings against the baseline: an unknown
check, a check that runs at no commit or push stage here, or a check whose findings stay out of every baseline.

@param session the repository and its checks.
@param only the named checks.
*/
function assertCountedChecks(session: Session, only: string[]): void {
    const counted = new Set(
        session.configuredChecks.filter(({ check }) => BASELINE_STAGES.has(check.stage)).map(({ check }) => check.id),
    );
    for (const id of only) {
        assertCheckExists(id, Object.values(session.settings.commandChecks));
        if (BASELINE_EXEMPT_CHECK.test(id))
            throw new GspotError('arguments', `${id} stays out of every baseline. Fix its findings instead.`);
        if (!counted.has(id))
            throw new GspotError(
                'arguments',
                `${id} runs at no commit or push stage of this repository, so a baseline holds no counts of it.`,
            );
    }
}

/**
Build the counts that the baseline file holds after a run. The run replaces the counts of the checks that it ran, or
with --prune lowers them, and keeps the counts of the checks that --only leaves out.

@param committed the counts of the file before the run.
@param checks the results of the run.
@param flags what the command does.
@param flags.prune lower the counts, and add none.
@param flags.only the checks to count, when not every check.
@returns the counts, and the summary of the change.
*/
function buildBaselineCounts(
    committed: BaselineCount[],
    checks: readonly CheckResult[],
    { prune = false, only }: BaselineFlags,
): { counts: BaselineCount[]; summary: string } {
    const named = new Set(only ?? committed.map(({ check }) => check));
    const previous = committed.filter(({ check }) => named.has(check));
    const changed = prune ? pruneBaseline(previous, checks) : { counts: countEveryCheck(checks), note: '' };
    const counts = [...committed.filter(({ check }) => !named.has(check)), ...changed.counts];
    const { findings, files } = sumCounts(counts);
    const held = `${formatCount(findings, 'finding')} in ${formatCount(files, 'file')}`;
    const removed = formatCount(sumCounts(previous).findings - sumCounts(changed.counts).findings, 'finding');
    const summary = prune
        ? `Removed ${removed} from ${BASELINE_FILE}. It holds ${held}.${changed.note}`
        : `Wrote ${BASELINE_FILE}: ${held}. Commit it.`;
    return { counts, summary };
}

async function runBaselineCommand(
    root: string,
    flags: BaselineFlags,
    cancelSignal: AbortSignal,
): Promise<CommandResult<BaselineJson>> {
    if (flags.prune === true && findText(root, BASELINE_FILE) === undefined)
        throw new GspotError('arguments', NO_BASELINE_MESSAGE);
    const session = await openSession(root, { cancelSignal });
    if (flags.only !== undefined) assertCountedChecks(session, flags.only);
    const committed = parseBaseline(findText(root, BASELINE_FILE));
    const { report } = await runEveryCheck(session, flags.only);
    const { counts, summary } = buildBaselineCounts(committed, report.checks, flags);
    openFiles(root).write(BASELINE_FILE, { bytes: Buffer.from(formatBaseline(counts)), mode: OWNER_WRITABLE_FILE });
    const { findings, files } = sumCounts(counts);
    const found = countFindings(report.checks);
    const leftOut = report.checks
        .filter(({ check, findings: reported }) => reported.length > 0 && found.every((each) => each.check !== check))
        .map(({ check }) => check);
    const notes = leftOut.length === 0 ? [] : [`${BASELINE_LEFT_OUT_MESSAGE} ${formatNameList(leftOut)}.`];
    return {
        text: `${[summary, ...notes].join('\n')}\n`,
        json: { summary, findingCount: findings, fileCount: files, leftOut },
        exitCode: 0,
    };
}

export const BASELINE_COMMAND: CommandDefinition<[], BaselineFlags> = {
    name: 'baseline',
    options: [{ flags: PRUNE_FLAG }, { flags: ONLY_OPTION, parse: parseCheckNames }],
    run: async (_arguments, flags, { root }) =>
        await runCancelableCommand(
            (cancelSignal) => runBaselineCommand(root, flags, cancelSignal),
            BASELINE_STOPPED_MESSAGE,
        ),
};
