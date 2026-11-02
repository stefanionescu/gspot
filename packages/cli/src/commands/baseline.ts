import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText } from '#cli/system/files/reads.ts';
import { runEveryCheck } from '#cli/generation/checks.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/engine.ts';
import type { BaselineCount } from '#cli/types/engine/run.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { BASELINE_FILE } from '#cli/config/repository/files.ts';
import { formatCount, formatNameList } from '#cli/system/text.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import type { CommandDefinition } from '#cli/types/commands/edits.ts';
import type { BaselineJson, BaselineFlags } from '#cli/types/commands/reports.ts';
import { pruneCounts, parseBaseline, countFindings, formatBaseline } from '#cli/engine/baseline.ts';

import {
    PRUNE_FLAG,
    NO_BASELINE_MESSAGE,
    BASELINE_STOPPED_MESSAGE,
    BASELINE_LEFT_OUT_MESSAGE,
} from '#cli/config/commands/reports.ts';

function sumCounts(counts: BaselineCount[]): Pick<BaselineJson, 'files' | 'findings'> {
    const findings = counts.reduce((total, { count }) => total + count, 0);
    const files = new Set(counts.map(({ file }) => file)).size;
    return { findings, files };
}

async function runBaselineCommand(
    root: string,
    { prune = false }: BaselineFlags,
    cancelSignal: AbortSignal,
): Promise<CommandResult<BaselineJson>> {
    if (prune && findText(root, BASELINE_FILE) === undefined) throw new GspotError('arguments', NO_BASELINE_MESSAGE);
    const previous = parseBaseline(findText(root, BASELINE_FILE));
    const { report } = await runEveryCheck(await openSession(root, { cancelSignal }));
    const stopped = report.checks.filter(({ status }) => INCOMPLETE_STATUSES.has(status)).map(({ check }) => check);
    if (stopped.length > 0)
        throw new GspotError(
            'tool',
            `gspot baseline needs every check to run, and ${formatNameList([...new Set(stopped)])} could not. Run gspot check to see why.`,
        );
    const found = countFindings(report.checks);
    const counts = prune ? pruneCounts(previous, found) : found;
    openFiles(root).write(BASELINE_FILE, { bytes: Buffer.from(formatBaseline(counts)), mode: OWNER_WRITABLE_FILE });
    const { findings, files } = sumCounts(counts);
    const held = `${formatCount(findings, 'finding')} in ${formatCount(files, 'file')}`;
    const removed = sumCounts(previous).findings - findings;
    const summary = prune
        ? `Removed ${formatCount(removed, 'finding')} from ${BASELINE_FILE}. It holds ${held}.`
        : `Wrote ${BASELINE_FILE}: ${held}. Commit it.`;
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

export const baselineCommand: CommandDefinition<[], BaselineFlags> = {
    name: 'baseline',
    options: [{ flags: PRUNE_FLAG }],
    run: async (_arguments, flags, { root }) =>
        await runCancelableCommand(
            (cancelSignal) => runBaselineCommand(root, flags, cancelSignal),
            BASELINE_STOPPED_MESSAGE,
        ),
};
