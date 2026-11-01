import { getTool } from '#cli/tools/pins.ts';
import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { findToolPath } from '#cli/tools/inspect.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { createCopy } from '#cli/engine/copies/files.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { runToolProcess } from '#cli/engine/tool-runs/tool.ts';
import { isReportedCrash } from '#cli/engine/tool-runs/output.ts';
import { listCopyFiles } from '#cli/engine/tool-runs/placeholders.ts';
import type { SpawnResult, FileContents } from '#cli/types/system.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/code/grammars.ts';
import { buildCommandLaunch, selectCommandFolder } from '#cli/engine/tool-runs/check.ts';
import { FIX_ROUNDS, CONFLICT_MARKER_LINE, FIX_CANCELED_MESSAGE } from '#cli/config/engine.ts';
import type { FixReport, FixResult, FixRounds, PathBytes, CheckSession, CommandLaunch } from '#cli/types/engine/run.ts';

function findFixFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    const { check } = planned;
    if (!isReportedCrash(check, planned.tool, result) && (result.code === 0 || check.exit_codes !== undefined))
        return undefined;
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n');
    return detail === '' ? `${planned.check.id} exited ${String(result.code)}` : detail;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Each fixer round and each run reads the same paths of a planned check through it.
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

function mergeResults(first: FixResult | undefined, next: FixResult): FixResult {
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
    const launch = buildCommandLaunch(selected, { session, command, root, toolPath: availability.path });
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

async function runFixer(session: CheckSession, planned: PlannedCheck): Promise<FixResult> {
    const check = planned.check.id;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'canceled', changed: [], note: FIX_CANCELED_MESSAGE };
    const { fix_extensions: extensions } = planned.check;
    const files =
        extensions === undefined
            ? planned.files
            : planned.files.filter(({ path }) => extensions.includes(extractExtension(path)));
    if (planned.skip !== undefined || files.length + planned.triggerPaths.length === 0)
        return { check, status: 'skipped', changed: [] };
    const command = planned.check.fix as string[];
    const name = command[0] as string;
    const tool = planned.tool?.name === name ? planned.tool : getTool(readConfigurations().values(), name);
    return runFixTool(session, { ...planned, files }, { command, tool });
}

function readContents(sourceRoot: string, paths: string[]): PathBytes {
    const contents: PathBytes = new Map();
    for (const path of paths) {
        try {
            contents.set(path, readBytes(sourceRoot, path));
        } catch (error) {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
            contents.set(path, undefined);
        }
    }
    return contents;
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

async function runFixerRounds(session: CheckSession, checks: PlannedCheck[], paths: string[]): Promise<FixRounds> {
    const results = new Map<number, FixResult>();
    let firstBefore: PathBytes | undefined;
    let after: PathBytes = new Map();
    const fixedContents = new Map<number, PathBytes>();
    let pending = checks.map((check, index) => ({ check, index }));
    for (let round = 0; round < FIX_ROUNDS && pending.length > 0; round += 1) {
        const before = readContents(session.root, paths);
        firstBefore ??= before;
        for (const { check, index } of pending) {
            results.set(index, mergeResults(results.get(index), await runFixer(session, check)));
            fixedContents.set(index, readContents(session.root, listPlannedPaths(checks[index] as PlannedCheck)));
        }
        after = readContents(session.root, paths);
        pending = checks.flatMap((check, index) => {
            const changed = new Set(listChangedPaths(fixedContents.get(index) as PathBytes, after));
            const files = check.files.filter((file) => changed.has(file.path) && after.get(file.path) !== undefined);
            return files.length === 0 ||
                results.get(index)?.status === 'failed' ||
                results.get(index)?.status === 'canceled'
                ? []
                : { check: { ...check, files, triggerPaths: [] }, index };
        });
    }
    return { results: results.values().toArray(), before: firstBefore ?? after, after };
}

async function listBrokenFiles(changed: string[], before: PathBytes, after: PathBytes): Promise<string[]> {
    const checked = await Promise.all(
        changed.map(async (path) => {
            const grammar = findGrammarByExtension(path);
            if (grammar === undefined) return [];
            const was = before.get(path);
            const now = after.get(path);
            if (was === undefined || now === undefined) return [];
            using wasTree = await parseSource(grammar, was.toString('utf8'));
            if (wasTree.rootNode.hasError) return [];
            using nowTree = await parseSource(grammar, now.toString('utf8'));
            return nowTree.rootNode.hasError ? [path] : [];
        }),
    );
    return checked.flat();
}

function restoreBrokenFiles(root: string, broken: string[], rounds: FixRounds): void {
    const files = openFiles(root);
    for (const path of broken) {
        const now = files.read(path) as FileContents;
        files.write(path, { ...now, bytes: rounds.before.get(path) as Buffer });
    }
}

function listConflictedPaths(root: string, paths: string[]): string[] {
    const contents = readContents(root, paths);
    return paths.filter((path) => CONFLICT_MARKER_LINE.test(contents.get(path)?.toString('utf8') ?? ''));
}

function buildFixResult(
    check: string,
    changed: string[],
    note: string | undefined,
    signal: AbortSignal | undefined,
): FixResult {
    if (signal?.aborted === true) return { check, changed, status: 'canceled', note: note ?? 'Canceled.' };
    if (note !== undefined) return { check, changed, status: 'failed', note };
    return { check, changed, status: changed.length === 0 ? 'unchanged' : 'changed' };
}

/**
Runs fixes in passes and collects their results.

@param session the repository and its tools.
@param planned the checks to fix.
*/
export async function runFixers(session: CheckSession, planned: PlannedCheck[]): Promise<FixReport> {
    const fixable = planned.filter((check) => check.check.fix !== undefined);
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
    return { results, changed: changed.filter((path) => !broken.includes(path)), broken, conflicted };
}
