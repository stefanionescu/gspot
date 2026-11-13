import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
    BASE_FLAG,
    FAILED_STATUSES,
    FIX_FLAG,
    GSPOT_CHECK_PREFIX,
    HOOK_FLAG,
    INCOMPLETE_STATUSES,
    ONLY_FLAG,
    RAN_STATUSES,
    SHORT_HASH_LENGTH,
    STAGED_FLAG,
} from '#cli/config/engine.ts';
import { GSPOT_CHECK } from '#cli/config/manifests.ts';
import { listRootPrefixes } from '#cli/engine/outputs/formats.ts';
import { listCheckedFiles } from '#cli/engine/plan/files.ts';
import { buildDashSafePath } from '#cli/engine/run/tool-runs/batches.ts';
import { listConflictedPaths } from '#cli/repository/git/output.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { remember } from '#cli/system/cache.ts';
import { buildArgumentPath, convertToPosixPath } from '#cli/system/paths.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import type { PlannedCheck, RunSelection } from '#cli/types/engine/plan.ts';
import type { CheckResult, CheckSession, Run, RunOptions } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

const WRITTEN_FILES = Symbol('written files');

function listSelectionArguments(selection: RunSelection): string[] {
    const base = selection.content === 'commit' ? selection.base?.slice(0, SHORT_HASH_LENGTH) : selection.base;
    const words = base === undefined ? [] : [BASE_FLAG, quoteArgument(base)];
    if (selection.messageArgument !== undefined)
        words.push(HOOK_FLAG, 'commit-msg', '--', quoteArgument(selection.messageArgument));
    if (selection.content === 'index') words.push(STAGED_FLAG);
    return words;
}

function buildWrittenPathMatcher(run: Run, result: CheckResult): (path: string) => boolean {
    const { session } = run;
    if (result.findings.length === 0 || result.check.startsWith(GSPOT_CHECK_PREFIX)) return () => false;
    return remember(session.cache, WRITTEN_FILES, session.root, () =>
        buildPathMatcher(session.generation.listWrittenGlobs(session)),
    );
}

function removeAcceptedFindings(run: Run, result: CheckResult): CheckResult {
    const { ignore } = run.session.settings;
    const isWritten = buildWrittenPathMatcher(run, result);
    const kept = result.findings.filter(
        (finding) =>
            !isWritten(finding.file) &&
            ignore.every((record) => {
                const isOtherFinding =
                    (record.check !== undefined && record.check !== finding.check) ||
                    (record.rule !== undefined && record.rule !== finding.rule && record.rule !== finding.fingerprint);
                return isOtherFinding || (record.paths !== undefined && !buildPathMatcher(record.paths)(finding.file));
            }),
    );
    if (!RAN_STATUSES.has(result.status)) return { ...result, findings: kept };
    return { ...result, findings: kept, status: kept.length > 0 ? 'failed' : 'passed' };
}

function removeOutsideFindings(result: CheckResult, run: Run): CheckResult {
    const { options, session } = run;
    if (options.paths === undefined) return result;
    const named = options.pathArguments.map((path) => buildArgumentPath(session.toolsRoot, options.cwd, path));
    return {
        ...result,
        findings: result.findings.filter(({ file }) => file === '' || named.some((path) => isInScope(file, path))),
    };
}

function findFixCommand(run: Run, result: CheckResult): Pick<CheckResult, 'fixCommand'> {
    const { options, session } = run;
    if (options.fix) return {};
    const listed = new Set(session.repository.files.map(({ path }) => path));
    const fixable = [
        ...new Set(
            result.findings.filter((finding) => finding.fixable && listed.has(finding.file)).map(({ file }) => file),
        ),
    ];
    const conflicted = new Set(listConflictedPaths(session.root, fixable));
    const files = new Set(fixable.filter((file) => !conflicted.has(file)));
    if (files.size === 0) return {};
    const command = [GSPOT_CHECK, FIX_FLAG, ONLY_FLAG, quoteArgument(result.check)];
    const isEveryFileChecked = options.paths === undefined && options.selection?.paths === undefined;
    if (isEveryFileChecked && result.findings.every(({ file }) => files.has(file)))
        return { fixCommand: command.join(' ') };
    const paths = [...files].map((file) => {
        const path = convertToPosixPath(relative(options.cwd, join(session.toolsRoot, file)));
        return quoteArgument(buildDashSafePath(path));
    });
    return { fixCommand: [...command, ...paths].join(' ') };
}

function normalizeResultPaths(session: Session, result: CheckResult): CheckResult {
    let restored = result;
    if (session.root !== session.toolsRoot) {
        const roots = new Set([session.root, realpathSync(session.root)]);
        for (const root of roots) restored = restoreCommandPaths(restored, root, session.toolsRoot);
    }
    let { note } = restored;
    if (note === undefined) return restored;
    const prefixes = listRootPrefixes(convertToPosixPath(session.toolsRoot));
    for (const prefix of prefixes) note = note.replaceAll(prefix, '');
    return { ...restored, note };
}

function formatReproduceCommand(
    checkId: string,
    scopeArgument: string | undefined,
    options: Pick<RunOptions, 'pathArguments' | 'selection'>,
): string {
    const { pathArguments: paths, selection = { content: 'working-tree' } } = options;
    const isScopeTarget = scopeArgument !== undefined && selection.messageFile === undefined && paths.length === 0;
    const targets = isScopeTarget ? [scopeArgument] : paths;
    const words = [
        GSPOT_CHECK,
        ...targets.map((path) => quoteArgument(buildDashSafePath(path))),
        ONLY_FLAG,
        quoteArgument(checkId),
        ...listSelectionArguments(selection),
    ];
    return words.join(' ');
}

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

export function measureSpan(start: number | undefined): Pick<CheckResult, 'duration' | 'span'> {
    const end = performance.now();
    const begin = start ?? end;
    return { duration: Math.round(end - begin), span: { start: begin, end } };
}

/**
Merge repeated runs of one check. Keep their findings and the base file count. Runs that overlap count once, so the
duration is the wall time from the first start to the last end.

@param merged the results collected so far.
@returns the combined result, with a missing-tool or process failure when the next run stops.
*/
export function mergeCheckResults(merged: CheckResult, next: CheckResult): CheckResult {
    const isStopped = INCOMPLETE_STATUSES.has(next.status);
    const status = merged.status === 'failed' || next.status === 'failed' ? 'failed' : merged.status;
    const spans = [merged.span, next.span].filter((span) => span !== undefined);
    const span =
        spans.length === 0
            ? undefined
            : {
                  start: Math.min(...spans.map(({ start }) => start)),
                  end: Math.max(...spans.map(({ end }) => end)),
              };
    return {
        ...merged,
        findings: [...merged.findings, ...next.findings],
        duration: span === undefined ? merged.duration + next.duration : Math.round(span.end - span.start),
        ...(span !== undefined && { span }),
        status: isStopped ? next.status : status,
        ...(isStopped && { note: next.note, command: next.command }),
    };
}

/**
Keep the findings in the files that the repository lists, for a tool that walks the disk past what Git tracks.
*/
export function keepListedFindings(session: CheckSession, result: CheckResult): CheckResult {
    const listed = new Set(session.repository.files.map(({ path }) => path));
    return { ...result, findings: result.findings.filter(({ file }) => listed.has(file)) };
}

export function restoreCommandPaths(result: CheckResult, copyRoot: string, sourceRoot: string): CheckResult {
    const { command, note } = result;
    return {
        ...result,
        ...(command !== undefined && {
            command: command.map((argument) => argument.replaceAll(copyRoot, () => sourceRoot)),
        }),
        ...(note !== undefined && { note: note.replaceAll(copyRoot, () => sourceRoot) }),
    };
}

export function finishResult(run: Run, ran: CheckResult): CheckResult {
    const result = normalizeResultPaths(run.session, removeAcceptedFindings(run, removeOutsideFindings(ran, run)));
    if (!FAILED_STATUSES.has(result.status) || run.session.cancelSignal?.aborted === true) return result;
    const scopeArgument =
        result.scope === ''
            ? undefined
            : convertToPosixPath(relative(run.options.cwd, join(run.session.toolsRoot, result.scope))) || '.';
    return {
        ...result,
        ...findFixCommand(run, result),
        rerun: formatReproduceCommand(result.check, scopeArgument, run.options),
    };
}
