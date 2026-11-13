import {
    PROGRESS_INTERVAL_MILLISECONDS,
    RUNNING_CHECKS_SHOWN,
    SHORT_HASH_LENGTH,
    STAGED_FILES,
    WORKING_TREE,
} from '#cli/config/engine.ts';
import { formatScopePrefix } from '#cli/repository/scopes.ts';
import { rewriteProgress, writeProgress } from '#cli/system/terminal.ts';
import { formatNameList, formatSeconds } from '#cli/system/text/messages.ts';
import type { CheckProgress, CheckResult } from '#cli/types/engine/run.ts';

function formatRunningChecks(running: Array<Pick<CheckResult, 'check' | 'scope'>>): string {
    const names = running
        .slice(0, RUNNING_CHECKS_SHOWN)
        .map(({ check, scope }) => `${formatScopePrefix(scope)}${check}`);
    const hidden = running.length - names.length;
    return formatNameList(hidden > 0 ? [...names, `${String(hidden)} more`] : names);
}

export function formatCheckedContent(comparison: CheckProgress['comparison']): string {
    if (comparison?.content === 'index') return STAGED_FILES;
    return comparison?.content === 'commit'
        ? `commit ${comparison.reference.slice(0, SHORT_HASH_LENGTH)}`
        : WORKING_TREE;
}

/**
Rewrite the progress line when stderr takes one. Otherwise print a line only for the checks that run past the progress
interval: the checks still running at each interval, and a check that finishes after it.
*/
export function printProgress(progress: CheckProgress): void {
    const subject = formatCheckedContent(progress.comparison);
    if (rewriteProgress(`Checking ${subject}: ${String(progress.finished)} of ${String(progress.total)} checks done`))
        return;
    if (progress.kind === 'running') {
        if (progress.running.length > 0)
            writeProgress(`running  ${formatRunningChecks(progress.running)}  ${formatSeconds(progress.elapsed)}\n`);
        return;
    }
    if (progress.duration < PROGRESS_INTERVAL_MILLISECONDS) return;
    writeProgress(`done  ${formatScopePrefix(progress.scope)}${progress.check}  ${formatSeconds(progress.duration)}\n`);
}
