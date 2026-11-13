import { realpathSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';

import {
    BASE_FLAG,
    HOOK_FLAG,
    INCOMPLETE_STATUSES,
    ONLY_FLAG,
    SHORT_HASH_LENGTH,
    STAGED_FLAG,
} from '#cli/config/engine.ts';
import { GSPOT_CHECK } from '#cli/config/manifests.ts';
import { listCheckedFiles } from '#cli/engine/files.ts';
import { listRootPrefixes, OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { findToolName, readShippedChecks } from '#cli/manifests/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildDashSafePath, convertToPosixPath } from '#cli/system/paths.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { canReadRuleExplanations } from '#cli/tools/rule-explanations.ts';
import type { PlannedCheck, RunSelection } from '#cli/types/engine/plan.ts';
import type {
    BuiltInCheck,
    CheckCode,
    CheckResult,
    CheckRunOptions,
    CheckSession,
    Finding,
    RunOptions,
} from '#cli/types/engine/run.ts';
import type { Check } from '#cli/types/manifests.ts';
import type { Session } from '#cli/types/tools.ts';

function listSelectionArguments(selection: RunSelection): string[] {
    const base = selection.content === 'commit' ? selection.base?.slice(0, SHORT_HASH_LENGTH) : selection.base;
    const words = base === undefined ? [] : [BASE_FLAG, quoteArgument(base)];
    if (selection.messageArgument !== undefined)
        words.push(HOOK_FLAG, 'commit-msg', '--', quoteArgument(selection.messageArgument));
    if (selection.content === 'index') words.push(STAGED_FLAG);
    return words;
}

export function canIgnoreRule(check: Check, code: CheckCode | undefined): boolean {
    return OUTPUT_FORMATS[check.output.format].namesRules(check.output) || code?.explanations !== undefined;
}

/**
Find the tool whose rules gspot reads: the tool of a check whose output names lint rules.
*/
export function findRuleTool(check: Check): string | undefined {
    return OUTPUT_FORMATS[check.output.format].namesRules(check.output) ? findToolName(check) : undefined;
}

/**
Tell whether a check has a rule catalog that covers a rule: rule explanations in its code, or a tool whose rules gspot
reads. Only then can gspot explain the rule, or check it against the rules that exist.
*/
export function hasRuleExplanations(check: Check, code: CheckCode | undefined, rule: string): boolean {
    if (code?.explanations !== undefined) return true;
    const tool = findRuleTool(check);
    return tool !== undefined && canReadRuleExplanations(tool, rule);
}

export function buildUnknownRuleError(rule: string, checkId: string): GspotError {
    return new GspotError('arguments', `gspot does not know rule ${rule} of ${checkId}.`);
}

export function formatExplainCommand(
    finding: Pick<Finding, 'check' | 'rule'>,
    selectCheckCode: (check: Check) => CheckCode | undefined,
): string {
    const argumentsList = [finding.check];
    const found = readShippedChecks().get(finding.check);
    const code = found === undefined ? undefined : selectCheckCode(found.check);
    if (
        found !== undefined &&
        finding.rule !== undefined &&
        hasRuleExplanations(found.check, code, finding.rule) &&
        (code?.explanations === undefined || Object.hasOwn(code.explanations, finding.rule))
    )
        argumentsList.push(finding.rule);
    return `gspot explain ${argumentsList.map((argument) => quoteArgument(argument)).join(' ')}`;
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
        fixable: finding.fixable === true,
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

export function normalizeResultPaths(session: Session, result: CheckResult): CheckResult {
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

export function formatReproduceCommand(
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
