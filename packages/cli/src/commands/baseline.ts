import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText } from '#cli/system/files/reads.ts';
import { runEveryCheck } from '#cli/generation/checks.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/engine.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { BASELINE_FILE } from '#cli/config/repository/files.ts';
import { formatCount, formatNameList } from '#cli/system/text.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import type { CommandDefinition } from '#cli/types/commands/edits.ts';
import type { CheckResult, BaselineCount } from '#cli/types/engine/run.ts';
import type { BaselineJson, BaselineFlags } from '#cli/types/commands/reports.ts';
import { pruneCounts, parseBaseline, countFindings, formatBaseline } from '#cli/engine/baseline.ts';

import {
    PRUNE_FLAG,
    NO_BASELINE_MESSAGE,
    BASELINE_STOPPED_MESSAGE,
    BASELINE_LEFT_OUT_MESSAGE,
} from '#cli/config/commands/reports.ts';

type BaselineWrite = { counts: BaselineCount[]; summary: string };

function formatStoppedChecks(checks: readonly CheckResult[]): string {
    const causes = checks.map(({ check, note }) => {
        const cause = note?.split('\n', 1).join('') ?? '';
        return cause === '' ? `  ${check}` : `  ${check}: ${cause}`;
    });
    const names = formatNameList([...new Set(checks.map(({ check }) => check))]);
    return `gspot baseline needs every check to run, and ${names} could not:\n${[...new Set(causes)].join('\n')}`;
}

function sumCounts(counts: BaselineCount[]): Pick<BaselineJson, 'files' | 'findings'> {
    const findings = counts.reduce((total, { count }) => total + count, 0);
    const files = new Set(counts.map(({ file }) => file)).size;
    return { findings, files };
}

function countEveryCheck(checks: readonly CheckResult[]): BaselineWrite {
    const stopped = checks.filter(({ status }) => INCOMPLETE_STATUSES.has(status));
    if (stopped.length > 0) throw new GspotError('tool', formatStoppedChecks(stopped));
    const counts = countFindings(checks);
    const { findings, files } = sumCounts(counts);
    const summary = `Wrote ${BASELINE_FILE}: ${formatCount(findings, 'finding')} in ${formatCount(files, 'file')}. Commit it.`;
    return { counts, summary };
}

/**
Lower the counts of the checks that ran to what they found. A check that did not run keeps its counts, because a prune
only lowers counts, so offline and in a sandbox it still drops the counts that the other checks did not find.

@param previous the committed counts.
@param checks the results of the run.
@returns the remaining counts, and the summary that names the checks that did not run.
*/
function pruneBaseline(previous: BaselineCount[], checks: readonly CheckResult[]): BaselineWrite {
    const kept = new Set(checks.filter(({ status }) => INCOMPLETE_STATUSES.has(status)).map(({ check }) => check));
    const counts = [
        ...previous.filter(({ check }) => kept.has(check)),
        ...pruneCounts(
            previous.filter(({ check }) => !kept.has(check)),
            countFindings(checks),
        ),
    ];
    const { findings, files } = sumCounts(counts);
    const removed = sumCounts(previous).findings - findings;
    const held = `${formatCount(findings, 'finding')} in ${formatCount(files, 'file')}`;
    const keptNote = kept.size === 0 ? '' : ` It keeps the counts of ${formatNameList([...kept])}, which did not run.`;
    return {
        counts,
        summary: `Removed ${formatCount(removed, 'finding')} from ${BASELINE_FILE}. It holds ${held}.${keptNote}`,
    };
}

async function runBaselineCommand(
    root: string,
    { prune = false }: BaselineFlags,
    cancelSignal: AbortSignal,
): Promise<CommandResult<BaselineJson>> {
    if (prune && findText(root, BASELINE_FILE) === undefined) throw new GspotError('arguments', NO_BASELINE_MESSAGE);
    const previous = parseBaseline(findText(root, BASELINE_FILE));
    const { report } = await runEveryCheck(await openSession(root, { cancelSignal }));
    const { counts, summary } = prune ? pruneBaseline(previous, report.checks) : countEveryCheck(report.checks);
    openFiles(root).write(BASELINE_FILE, { bytes: Buffer.from(formatBaseline(counts)), mode: OWNER_WRITABLE_FILE });
    const { findings, files } = sumCounts(counts);
    const found = countFindings(report.checks);
    const leftOut = report.checks
        .filter(({ check, findings: reported }) => reported.length > 0 && found.every((each) => each.check !== check))
        .map(({ check }) => check);
    const notes = leftOut.length === 0 ? [] : [`${BASELINE_LEFT_OUT_MESSAGE} ${formatNameList(leftOut)}.`];
    return {
        text: `${[summary, ...notes].join('\n')}\n`,
        json: { summary, findings, files, leftOut },
        exitCode: 0,
    };
}

export const BASELINE_COMMAND: CommandDefinition<[], BaselineFlags> = {
    name: 'baseline',
    options: [{ flags: PRUNE_FLAG }],
    run: async (_arguments, flags, { root }) =>
        await runCancelableCommand(
            (cancelSignal) => runBaselineCommand(root, flags, cancelSignal),
            BASELINE_STOPPED_MESSAGE,
        ),
};
