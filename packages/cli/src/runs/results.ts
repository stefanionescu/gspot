import { realpathSync } from 'node:fs';
import { listCheckedFiles } from '#cli/planning/files.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/runs/runs.ts';
import { type Session, type CheckSession } from '#cli/types/session.ts';
import { type CheckResult, type BuiltInCheck } from '#cli/types/runs/check.ts';

/**
Starts a passed check result with the check ID, scope, and file count.

@param planned the check to run.
@param session the scopes of the run.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Sharing the result shape prevents duplicate literals in command checks.
export function buildBaseResult(planned: PlannedCheck, session: Pick<Session, 'scopes'>): CheckResult {
    return {
        check: planned.check.id,
        scope: planned.scope.path,
        status: 'passed',
        fileCount: listCheckedFiles(session.scopes, planned).length,
        duration: 0,
        findings: [],
    };
}

/**
Merge repeated runs of one check. Keep their findings and the base file count.

@param merged the results collected so far.
@param next the next run of the same check.
@returns the combined result, with a missing-tool or process failure when the next run stops.
*/
export function mergeCheckResults(merged: CheckResult, next: CheckResult): CheckResult {
    const isStopped = INCOMPLETE_STATUSES.has(next.status);
    const status = merged.status === 'failed' || next.status === 'failed' ? 'failed' : merged.status;
    return {
        ...merged,
        findings: [...merged.findings, ...next.findings],
        duration: merged.duration + next.duration,
        status: isStopped ? next.status : status,
        ...(isStopped && { note: next.note, command: next.command }),
    };
}

/**
Run a built-in check and attach its help and file count to the result.

@param builtInCheck the implementation that reads repository files.
@param session the current check session.
@param planned the configured check and selected files.
@returns the findings and execution status.
*/
export async function runBuiltInCheck(
    builtInCheck: BuiltInCheck,
    session: CheckSession,
    planned: PlannedCheck,
): Promise<CheckResult> {
    const started = performance.now();
    const result = await builtInCheck(session, planned);
    const findings = (Array.isArray(result) ? result : result.findings).map((finding) => ({
        ...finding,
        check: planned.check.id,
        fixable: false,
        help: finding.help ?? planned.check.help,
    }));
    const files = Array.isArray(result) ? undefined : [...new Set(result.files)];
    return {
        ...buildBaseResult(planned, session),
        findings,
        ...(files !== undefined && { files, fileCount: files.length }),
        status: findings.length > 0 ? 'failed' : 'passed',
        duration: Math.round(performance.now() - started),
    };
}

/**
Replace temporary revision paths with the repository path in reported commands and notes.

@param session the working and temporary repository folders.
@param result the result to update.
*/
export function normalizeResultPaths(session: Session, result: CheckResult): void {
    if (session.root === session.toolsRoot) return;
    for (const root of new Set([session.root, realpathSync(session.root)])) {
        if (result.command !== undefined)
            result.command = result.command.map((argument) => argument.replaceAll(root, session.toolsRoot));
        if (result.note !== undefined) result.note = result.note.replaceAll(root, session.toolsRoot);
    }
}
