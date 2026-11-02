import { realpathSync } from 'node:fs';
import { findToolName } from '#cli/tools/pins.ts';
import type { Session } from '#cli/types/tools.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { setImmediate } from 'node:timers/promises';
import { listCheckedFiles } from '#cli/engine/files.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/engine.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import type { CheckResult, CheckSession, BuiltInCheck, CheckRunOptions } from '#cli/types/engine/run.ts';

/**
Build the command that explains a finding's check and rule.

@param finding the reported check and optional rule identifier.
*/
export function formatExplainCommand(finding: Pick<Finding, 'check' | 'rule'>): string {
    const argumentsList = [finding.check];
    const found = listChecksById(readConfigurations().values()).get(finding.check);
    if (
        found !== undefined &&
        finding.rule !== undefined &&
        OUTPUT_FORMATS[found.check.output.format].namesRules(found.check.output) &&
        findToolName(found.check) !== undefined
    )
        argumentsList.push(finding.rule);
    return `gspot explain ${argumentsList.map((argument) => quoteArgument(argument)).join(' ')}`;
}

/**
Starts a passed check result with the check ID, scope, and file count.

@param planned the check to run.
@param session the scopes of the run.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Built-in checks, command checks, and the check runner start each result from this one shape.
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
@param options the verbosity of the findings.
*/
export async function runBuiltInCheck(
    builtInCheck: BuiltInCheck,
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions,
): Promise<CheckResult> {
    await setImmediate();
    const started = performance.now();
    const result = await builtInCheck(session, planned, options);
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
        ...(!Array.isArray(result) && result.notes !== undefined && { reportNotes: result.notes }),
        status: findings.length > 0 ? 'failed' : 'passed',
        duration: Math.round(performance.now() - started),
    };
}

/**
Replaces the paths of a copy in the reported command with repository paths.

@param result the run, which may have no command.
@param copyRoot the folder of the copy that the tool ran in.
@param sourceRoot the repository folder that the finding paths point into.
*/
export function restoreCommandPaths(result: CheckResult, copyRoot: string, sourceRoot: string): CheckResult {
    if (result.command === undefined) return result;
    return {
        ...result,
        command: result.command.map((argument) => argument.replaceAll(copyRoot, () => sourceRoot)),
    };
}

/**
Replace temporary revision paths with the repository path in reported commands and notes.

@param session the working and temporary repository folders.
@param result the result to read.
*/
export function normalizeResultPaths(session: Session, result: CheckResult): CheckResult {
    if (session.root === session.toolsRoot) return result;
    let { command, note } = result;
    const roots = new Set([session.root, realpathSync(session.root)]);
    for (const root of roots) {
        command = command?.map((argument) => argument.replaceAll(root, () => session.toolsRoot));
        note = note?.replaceAll(root, () => session.toolsRoot);
    }
    return { ...result, ...(command !== undefined && { command }), ...(note !== undefined && { note }) };
}
