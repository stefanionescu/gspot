import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import { getRequired } from '#cli/system/tables.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { isActive } from '#cli/engine/plan/checks.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { compareText } from '#cli/system/text/order.ts';
import { createCopy } from '#cli/engine/copies/files.ts';
import { findCommandTool } from '#cli/manifests/tools.ts';
import { readContents } from '#cli/system/files/reads.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { findToolPath } from '#cli/tools/programs/inspect.ts';
import { runToolProcess } from '#cli/engine/run/tool-runs/tool.ts';
import { listConflictedPaths } from '#cli/repository/git/output.ts';
import { listCopyFiles } from '#cli/engine/run/tool-runs/configs.ts';
import { isReportedCrash } from '#cli/engine/run/tool-runs/failures.ts';
import { FIX_ROUNDS, FIX_CANCELED_MESSAGE } from '#cli/config/engine.ts';
import type { PlannedCheck, FixerPlannedCheck } from '#cli/types/engine/plan.ts';
import type { PathBytes, SpawnResult, FileContents } from '#cli/types/system.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/code/grammars.ts';
import { buildCommandLaunch, selectCommandFolder } from '#cli/engine/run/tool-runs/check.ts';

import type {
    FixReport,
    FixResult,
    FixRounds,
    BuiltInFix,
    RunOptions,
    CheckSession,
    CommandLaunch,
} from '#cli/types/engine/run.ts';

function findFixFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    const { check } = planned;
    if (!isReportedCrash(check, planned.tool, result) && (result.code === 0 || check.exit_codes !== undefined))
        return undefined;
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n');
    return detail === '' ? `${planned.check.id} exited ${String(result.code)}` : detail;
}

function listPlannedPaths(planned: PlannedCheck): string[] {
    return [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
}

async function runFixCommands(session: Session, planned: PlannedCheck, setup: CommandLaunch): Promise<FixResult> {
    const check = planned.check.id;
    const paths = listPlannedPaths(planned);
    const before = readContents(setup.root, paths);
    let note: string | undefined;
    for (const command of setup.commandLines) {
        const { result, failure } = await runToolProcess(command.commandArguments, {
            ...setup,
            cancelSignal: session.cancelSignal,
            timeoutSeconds: session.settings.tool_timeout_seconds,
            name: planned.check.id,
        });
        note = failure?.note ?? findFixFailure(planned, result);
        if (note !== undefined) break;
    }
    const changed = listChangedPaths(before, readContents(setup.root, paths));
    return buildFixResult(check, changed, note, session.cancelSignal);
}

function mergeFixResults(first: FixResult | undefined, next: FixResult): FixResult {
    if (first === undefined) return next;
    const changed = [...new Set([...first.changed, ...next.changed])];
    if (next.status === 'failed' || next.status === 'canceled') return { ...next, changed };
    return { check: next.check, status: changed.length === 0 ? next.status : 'changed', changed };
}

async function runFixTool(
    session: CheckSession,
    planned: PlannedCheck,
    { command, tool }: { command: string[]; tool: Tool },
): Promise<FixResult> {
    const selected = { ...planned, tool };
    const availability = await findToolPath(session, tool, selectCommandFolder(session.root, selected));
    if ('status' in availability)
        return { check: planned.check.id, status: 'failed', changed: [], note: availability.note };
    using copy =
        planned.check.run_in_copy === true
            ? await createCopy(session, listCopyFiles(session, selected, command))
            : undefined;
    const root = copy?.path ?? session.root;
    const launch = buildCommandLaunch(selected, { session, command, root, tool, toolPath: availability.path });
    const result = await runFixCommands(session, selected, launch);
    if (copy === undefined) return result;
    const files = openFiles(session.root);
    const corrected = openFiles(copy.path);
    for (const path of result.changed) {
        const value = corrected.read(path);
        if (value === undefined) files.deleteFile(path);
        else files.write(path, value);
    }
    return result;
}

async function runFixer(session: CheckSession, planned: FixerPlannedCheck): Promise<FixResult> {
    const check = planned.check.id;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'canceled', changed: [], note: FIX_CANCELED_MESSAGE };
    if (planned.skip !== undefined || planned.files.length + planned.triggerPaths.length === 0)
        return { check, status: 'skipped', changed: [] };
    const command = planned.check.fix;
    const [name] = command;
    const tool = planned.tool?.name === name ? planned.tool : findCommandTool(readConfigurations().values(), name);
    return runFixTool(session, planned, { command, tool });
}

async function runBuiltInFix(session: CheckSession, planned: PlannedCheck, fix: BuiltInFix): Promise<FixResult> {
    const check = planned.check.id;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'canceled', changed: [], note: FIX_CANCELED_MESSAGE };
    // A fix in code writes to the working tree, and a copy of a revision is not the working tree.
    if (planned.skip !== undefined || !isActive(planned, session.selection) || session.root !== session.toolsRoot)
        return { check, status: 'skipped', changed: [] };
    try {
        return buildFixResult(check, await fix(session), undefined, session.cancelSignal);
    } catch (error) {
        if (!(error instanceof GspotError)) throw error;
        return { check, status: 'failed', changed: [], note: error.message };
    }
}

async function runBuiltInFixes(
    session: CheckSession,
    planned: PlannedCheck[],
    selectCheckCode: RunOptions['selectCheckCode'],
): Promise<FixResult[]> {
    const results: FixResult[] = [];
    for (const check of planned) {
        const fix = selectCheckCode(check.check)?.fix;
        if (fix !== undefined) results.push(await runBuiltInFix(session, check, fix));
    }
    return results;
}

function listChangedPaths(before: PathBytes, after: PathBytes): string[] {
    return before
        .keys()
        .filter((path) => {
            const was = before.get(path);
            const now = after.get(path);
            return was === undefined || now === undefined ? was !== now : !was.equals(now);
        })
        .toArray();
}

function listPendingFixes({
    checks,
    results,
    fixedContents,
    after,
}: {
    checks: FixerPlannedCheck[];
    results: Map<number, FixResult>;
    fixedContents: Map<number, PathBytes>;
    after: PathBytes;
}): Array<{ check: FixerPlannedCheck; index: number }> {
    return checks.flatMap((check, index) => {
        const status = results.get(index)?.status;
        if (status === 'failed' || status === 'canceled') return [];
        const changed = new Set(listChangedPaths(getRequired(fixedContents, index, 'fixed contents'), after));
        const files = check.files.filter((file) => changed.has(file.path) && after.get(file.path) !== undefined);
        return files.length === 0 ? [] : [{ check: { ...check, files, triggerPaths: [] }, index }];
    });
}

async function runFixerRounds(session: CheckSession, checks: FixerPlannedCheck[], paths: string[]): Promise<FixRounds> {
    const results = new Map<number, FixResult>();
    let firstBefore: PathBytes | undefined;
    let after: PathBytes = new Map();
    const fixedContents = new Map<number, PathBytes>();
    let pending = checks.map((check, index) => ({ check, index }));
    for (let round = 0; round < FIX_ROUNDS && pending.length > 0; round += 1) {
        const before = readContents(session.root, paths);
        firstBefore ??= before;
        const groups = Map.groupBy(pending, ({ check }) => check.check.id).values();
        for (const group of groups) {
            const fixed = await Promise.all(group.map(({ check }) => runFixer(session, check)));
            for (const [position, { index }] of group.entries()) {
                results.set(index, mergeFixResults(results.get(index), fixed[position] as FixResult));
                fixedContents.set(index, readContents(session.root, listPlannedPaths(checks[index] as PlannedCheck)));
            }
        }
        after = readContents(session.root, paths);
        pending = listPendingFixes({ checks, results, fixedContents, after });
    }
    return { results: results.values().toArray(), before: firstBefore ?? after, after };
}

async function isBrokenByFix(path: string, before: PathBytes, after: PathBytes): Promise<boolean> {
    const grammar = findGrammarByExtension(path);
    if (grammar === undefined) return false;
    const previous = before.get(path);
    const fixed = after.get(path);
    if (previous === undefined || fixed === undefined) return false;
    using previousTree = await parseSource(grammar, previous.toString('utf8'));
    if (previousTree.rootNode.hasError) return false;
    using fixedTree = await parseSource(grammar, fixed.toString('utf8'));
    return fixedTree.rootNode.hasError;
}

async function listBrokenFiles(changed: string[], before: PathBytes, after: PathBytes): Promise<string[]> {
    const broken = await Promise.all(changed.map((path) => isBrokenByFix(path, before, after)));
    return changed.filter((_, index) => broken[index] === true);
}

function restoreBrokenFiles(root: string, broken: string[], rounds: FixRounds): void {
    const files = openFiles(root);
    for (const path of broken) {
        const now = files.read(path) as FileContents;
        files.write(path, { ...now, bytes: getRequired(rounds.before, path, 'file contents') });
    }
}

function buildFixResult(
    check: string,
    changed: string[],
    note: string | undefined,
    signal: AbortSignal | undefined,
): FixResult {
    if (signal?.aborted === true) return { check, changed, status: 'canceled', note: note ?? FIX_CANCELED_MESSAGE };
    if (note !== undefined) return { check, changed, status: 'failed', note };
    return { check, changed, status: changed.length === 0 ? 'unchanged' : 'changed' };
}

/**
Run the fixes of the planned checks. The fixes in check code run first, so that the fixer commands read the generated
config files that those fixes rewrite.
*/
export async function runFixers(
    session: CheckSession,
    planned: PlannedCheck[],
    selectCheckCode: RunOptions['selectCheckCode'],
): Promise<FixReport> {
    const written = await runBuiltInFixes(session, planned, selectCheckCode);
    const fixable = planned.filter((check): check is FixerPlannedCheck => check.check.fix !== undefined);
    const conflicted = listConflictedPaths(session.root, [
        ...new Set(fixable.flatMap((check) => listPlannedPaths(check))),
    ]);
    const checks = fixable.map((check) => ({
        ...check,
        files: check.files.filter((file) => !conflicted.includes(file.path)),
        triggerPaths: check.triggerPaths.filter((path) => !conflicted.includes(path)),
    }));
    const paths = [...new Set(checks.flatMap((check) => listPlannedPaths(check)))].toSorted((a, b) =>
        compareText(a, b),
    );
    const rounds = await runFixerRounds(session, checks, paths);
    const { before, after, results } = rounds;
    const changed = listChangedPaths(before, after);
    const broken = await listBrokenFiles(changed, before, after);
    restoreBrokenFiles(session.root, broken, rounds);
    return {
        results: [...written, ...results],
        changed: [
            ...new Set([
                ...written.flatMap((result) => result.changed),
                ...changed.filter((path) => !broken.includes(path)),
            ]),
        ],
        broken,
        conflicted,
    };
}
