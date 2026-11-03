import { realpathSync } from 'node:fs';
import { findToolName } from '#cli/tools/pins.ts';
import type { Session } from '#cli/types/tools.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { setImmediate } from 'node:timers/promises';
import type { Check } from '#cli/types/manifests.ts';
import { canReadRuleDocs } from '#cli/tools/rules.ts';
import { listCheckedFiles } from '#cli/engine/files.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import { type RunSelection, type PlannedCheck } from '#cli/types/engine/plan.ts';

import type {
    CheckCode,
    RunOptions,
    CheckResult,
    CheckSession,
    BuiltInCheck,
    CheckRunOptions,
} from '#cli/types/engine/run.ts';
import {
    HOOK_FLAG,
    BASE_FLAG,
    STAGED_FLAG,
    CHECK_COMMAND,
    SHORT_HASH_LENGTH,
    INCOMPLETE_STATUSES,
} from '#cli/config/engine.ts';

/**
Tell whether a check has a rule catalog: rule docs in its code, or a tool whose rules gspot reads. Only then can gspot
explain one of its rules, or check a rule of an ignore against the rules that exist.

@param check the check that reports the rules.
@param code the implementation of the check, if it has one.
*/
export function hasRuleDocs(check: Check, code: CheckCode | undefined): boolean {
    if (code?.ruleDocs !== undefined) return true;
    const tool = OUTPUT_FORMATS[check.output.format].namesRules(check.output) ? findToolName(check) : undefined;
    return tool !== undefined && canReadRuleDocs(tool);
}

/**
Build the command that explains a finding's check, and its rule when the rule catalog of the check holds it.

@param finding the reported check and optional rule identifier.
@param selectCheckCode finds the implementation of a check, whose rule docs name its rules.
*/
export function formatExplainCommand(
    finding: Pick<Finding, 'check' | 'rule'>,
    selectCheckCode: (check: Check) => CheckCode | undefined,
): string {
    const argumentsList = [finding.check];
    const found = listChecksById(readConfigurations().values()).get(finding.check);
    const code = found === undefined ? undefined : selectCheckCode(found.check);
    if (
        found !== undefined &&
        finding.rule !== undefined &&
        hasRuleDocs(found.check, code) &&
        (code?.ruleDocs === undefined || Object.hasOwn(code.ruleDocs, finding.rule))
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
Measure a tool run from the moment the process limiter gave it a slot to now.

@param start the monotonic time of the first slot, or undefined when no process started.
*/
export function measureSpan(start: number | undefined): Pick<CheckResult, 'duration' | 'span'> {
    const end = performance.now();
    const begin = start ?? end;
    return { duration: Math.round(end - begin), span: { start: begin, end } };
}

/**
Merge repeated runs of one check. Keep their findings and the base file count. Runs that overlap count once, so the
duration is the wall time from the first start to the last end.

@param merged the results collected so far.
@param next the next run of the same check.
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

function listSelectionArguments(selection: RunSelection): string[] {
    const base = selection.content === 'commit' ? selection.base?.slice(0, SHORT_HASH_LENGTH) : selection.base;
    const words = base === undefined ? [] : [BASE_FLAG, quoteArgument(base)];
    if (selection.messageFile !== undefined)
        words.push(HOOK_FLAG, 'commit-msg', '--', quoteArgument(selection.messageFile));
    if (selection.content === 'index') words.push(STAGED_FLAG);
    return words;
}

/**
Format the command that runs one check again on what this run selected.

@param checkId the check to run.
@param scopeArgument the scope folder, relative to the working folder, or undefined for the root.
@param options the paths and the selection of the run.
*/
export function formatReproduceCommand(
    checkId: string,
    scopeArgument: string | undefined,
    options: Pick<RunOptions, 'pathArguments' | 'selection'>,
): string {
    const { pathArguments: paths, selection = { content: 'working-tree' } } = options;
    const isScopeTarget = scopeArgument !== undefined && selection.messageFile === undefined && paths.length === 0;
    const targets = isScopeTarget ? [scopeArgument] : paths;
    const words = [
        CHECK_COMMAND,
        ...targets.map((path) => quoteArgument(path.startsWith('-') ? `./${path}` : path)),
        '--only',
        quoteArgument(checkId),
        ...listSelectionArguments(selection),
    ];
    return words.join(' ');
}
