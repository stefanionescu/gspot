import { createTwoFilesPatch } from 'diff';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { hasToolError } from '#cli/checks/run/command/output.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import type { PreparedCommand } from '#cli/types/checks/run/command.ts';
import { findTool, runPlannedTool } from '#cli/checks/run/command/tool.ts';
import { FIX_PASSES, FIX_DIFF_CONTEXT } from '#cli/config/checks/run/run.ts';
import { copyIntoScratch, selectScratchCopyPaths } from '#cli/checks/run/copy/scratch.ts';
import { prepareCommand, prepareInScratch, buildCommandEnvironment } from '#cli/checks/run/command/check.ts';

import {
    type FixReport,
    type FixResult,
    type FixOptions,
    type CheckRunOptions,
    type CheckImplementations,
} from '#cli/types/checks/run/check.ts';

function fixFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    // A code the check declares for findings means findings remain after the fix.
    const { check } = planned;
    if (!hasToolError(check, planned.tool, result) && (result.code === 0 || check.exit_codes !== undefined))
        return undefined;
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n');
    return detail === '' ? `${planned.check.name} exited ${String(result.code)}` : detail;
}

async function runFix(session: Session, planned: PlannedCheck, prepared: PreparedCommand): Promise<FixResult> {
    const check = planned.check.name;
    const paths = [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
    const before = readContents(prepared.root, paths);
    let note: string | undefined;
    for (const command of prepared.commands) {
        const { result, failure } = await runPlannedTool(
            command.commandArguments,
            {
                ...prepared,
                cancelSignal: session.cancelSignal,
            },
            planned.selection.view,
            planned.check.name,
        );
        note = failure?.note ?? fixFailure(planned, result);
        if (note !== undefined) break;
    }
    const changed = listChangedPaths(before, readContents(prepared.root, paths));
    return note === undefined
        ? { check, status: changed.length === 0 ? 'unchanged' : 'changed', changed }
        : { check, status: 'failed', changed, note };
}

async function runFixInScratch(
    planned: PlannedCheck,
    {
        session,
        root,
        command,
        toolPath,
        options,
    }: { session: Session; root: string; command: string[]; toolPath: string; options: CheckRunOptions },
): Promise<FixResult> {
    const preparedScratch = await prepareInScratch(planned, {
        session: { ...session, root },
        command,
        toolPath,
        options,
    });
    using scratch = preparedScratch.copy;
    const prepared = preparedScratch.prepared;
    using files = openFiles(root);
    const paths = [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
    const originals = new Map(paths.map((path) => [path, files.read(path)]));
    const result = await runFix(session, planned, prepared);
    using corrected = openFiles(scratch.path);
    for (const path of result.changed) {
        const original = originals.get(path);
        const value = corrected.read(path);
        if (value !== undefined) files.write(path, value, original);
        else if (original !== undefined) files.deleteFile(path, original);
    }
    return result;
}

// Merges the passes of one fixer: a failure stands, and the changed files add up.
function mergeResults(first: FixResult | undefined, next: FixResult): FixResult {
    if (first === undefined) return next;
    const changed = [...new Set([...first.changed, ...next.changed])];
    if (first.status === 'failed') return { ...first, changed };
    if (next.status === 'failed') return { ...next, changed };
    return { check: next.check, status: changed.length === 0 ? next.status : 'changed', changed };
}

async function runCommandFix(
    session: Session,
    planned: PlannedCheck,
    workingFolder: string,
    options: CheckRunOptions,
): Promise<FixResult> {
    const check = planned.check.name;
    // runFixers selects only checks with a validated, nonempty fixer command.
    const command = planned.check.fix as string[];
    const name = command[0] as string;
    const tool =
        planned.tool?.name === name
            ? planned.tool
            : getToolDeclaration(session.manifests.values(), name, planned.manifest);
    const selected = { ...planned, tool };
    const environment = buildCommandEnvironment(session, selected, options);
    const { env, cwd } = environment;
    const availability = findTool(session, cwd, tool, env);
    if ('status' in availability)
        return {
            check,
            status: 'failed',
            changed: [],
            note: availability.note,
        };
    if (planned.check.run_in_copy === true)
        return runFixInScratch(selected, {
            session,
            root: workingFolder,
            command,
            toolPath: availability.path,
            options,
        });
    const scratchSession = { ...session, root: workingFolder };
    const prepared = prepareCommand(selected, {
        session: scratchSession,
        command,
        environment:
            workingFolder === session.root ? environment : buildCommandEnvironment(scratchSession, selected, options),
        toolPath: availability.path,
    });
    return runFix(session, planned, prepared);
}

// A canceled or skipped fix returns before it finds the tool or writes files.
async function runFixer(session: Session, planned: PlannedCheck, root: string): Promise<FixResult> {
    const check = planned.check.name;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'failed', changed: [], note: 'The fix was canceled.' };
    if (planned.skip !== undefined || planned.files.length + planned.triggerPaths.length === 0)
        return { check, status: 'skipped', changed: [] };
    const implementations: CheckImplementations = CHECK_IMPLEMENTATIONS;
    const builtIn = implementations[check];
    return runCommandFix(session, planned, root, {
        arguments: builtIn?.arguments,
        toolFiles: builtIn?.toolFiles,
    });
}

/**
 * Reads the bytes of each path, with undefined for a missing file.
 * @param sourceRoot the folder the paths start from.
 * @param paths the repository-relative files to read.
 * @returns the bytes of each file, or undefined.
 */
function readContents(sourceRoot: string, paths: string[]): Map<string, Buffer | undefined> {
    const contents = new Map<string, Buffer | undefined>();
    for (const path of paths) {
        try {
            contents.set(path, readBytes(sourceRoot, path));
        } catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
            contents.set(path, undefined);
        }
    }
    return contents;
}

/**
 * Lists the paths whose bytes changed, appeared, or disappeared.
 * @param before the earlier bytes.
 * @param after the later bytes.
 * @returns each path whose bytes differ.
 */
function listChangedPaths(before: Map<string, Buffer | undefined>, after: Map<string, Buffer | undefined>): string[] {
    return before
        .keys()
        .filter((path) => {
            const was = before.get(path);
            const now = after.get(path);
            return was === undefined || now === undefined ? was !== now : !was.equals(now);
        })
        .toArray();
}

/**
 * Runs the fixers again on changed files, so a formatter handles the changes of a later codemod.
 * @param session the repository and its tools.
 * @param checks the fixers to run.
 * @param sourceRoot the folder that the fixers change.
 * @param paths the files to compare between passes.
 * @returns each fixer result, and the file bytes before and after.
 */
async function runFixerPasses(
    session: Session,
    checks: PlannedCheck[],
    sourceRoot: string,
    paths: string[],
): Promise<{
    results: FixResult[];
    before: Map<string, Buffer | undefined>;
    after: Map<string, Buffer | undefined>;
}> {
    const results = new Map<number, FixResult>();
    let firstBefore: Map<string, Buffer | undefined> | undefined;
    let after = new Map<string, Buffer | undefined>();
    let pending = checks.map((check, index) => ({ check, index }));
    for (let pass = 0; pass < FIX_PASSES && pending.length > 0; pass += 1) {
        const before = readContents(sourceRoot, paths);
        firstBefore ??= before;
        for (const { check, index } of pending)
            results.set(index, mergeResults(results.get(index), await runFixer(session, check, sourceRoot)));
        after = readContents(sourceRoot, paths);
        const changed = new Set(listChangedPaths(before, after));
        pending = checks.flatMap((check, index) => {
            const files = check.files.filter((file) => changed.has(file.path) && after.get(file.path) !== undefined);
            if (files.length === 0 || results.get(index)?.status === 'failed') return [];
            return [{ check: { ...check, files, triggerPaths: [] }, index }];
        });
    }
    return { results: [...results.values()], before: firstBefore ?? after, after };
}

/**
 * Runs fixes in passes and collects their results. A dry run always removes its scratch copy.
 * @param session the repository and its tools.
 * @param planned the checks to fix.
 * @param options whether to run in a scratch copy and report diffs.
 * @returns the fix results, changed paths, and dry-run diffs.
 */
export async function runFixers(session: Session, planned: PlannedCheck[], options: FixOptions): Promise<FixReport> {
    const { isDryRun } = options;
    const checks = planned.filter((check) => check.check.fix !== undefined);
    const paths = [
        ...new Set(checks.flatMap((check) => [...check.files.map((file) => file.path), ...check.triggerPaths])),
    ].toSorted((a, b) => a.localeCompare(b));
    using scratch = isDryRun
        ? await copyIntoScratch(
              selectScratchCopyPaths(
                  session.root,
                  [...paths, ...session.repository.files.map((file) => file.path)],
                  session.repository.scopes.map((scope) => scope.path),
              ),
          )
        : undefined;
    const root = scratch?.path ?? session.root;
    const { before, after, results } = await runFixerPasses(session, checks, root, paths);
    const changed = listChangedPaths(before, after);
    const diffs = isDryRun
        ? changed.map((path) =>
              createTwoFilesPatch(
                  `a/${convertToPosixPath(path)}`,
                  `b/${convertToPosixPath(path)}`,
                  before.get(path)?.toString('utf8') ?? '',
                  after.get(path)?.toString('utf8') ?? '',
                  '',
                  '',
                  { context: FIX_DIFF_CONTEXT },
              ),
          )
        : [];
    return { results, changed, diffs };
}
