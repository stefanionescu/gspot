import { createTwoFilesPatch } from 'diff';
import { toPosix } from '#cli/system/paths.ts';
import { readSource } from '#cli/system/files/reads.ts';
import { openSafeFolder } from '#cli/system/files/open.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { PreparedCommand } from '#cli/types/execution/command.ts';
import { findTool, runPlannedTool } from '#cli/execution/command/tool.ts';
import { FIX_PASSES, FIX_DIFF_CONTEXT } from '#cli/config/execution/run.ts';
import { hasToolError, toolOutputDetail } from '#cli/execution/command/output.ts';
import { copyIntoScratch, projectCopyInputs } from '#cli/execution/copy/scratch.ts';
import { prepareCommand, prepareInScratch, commandEnvironment } from '#cli/execution/command/check.ts';
import type { FixReport, FixResult, FixOptions, BuiltInChecks, CheckRunOptions } from '#cli/types/execution/check.ts';

function fixFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    // A code the check declares for findings means findings remain after the fix.
    const { check } = planned;
    if (!hasToolError(check, planned.tool, result) && (result.code === 0 || check.exit_codes !== undefined))
        return undefined;
    const detail = toolOutputDetail(result, '');
    return [`${planned.check.name} exited ${String(result.code)}`, detail].filter((text) => text !== '').join(': ');
}

async function runFix(session: Session, planned: PlannedCheck, prepared: PreparedCommand): Promise<FixResult> {
    const check = planned.check.name;
    const paths = [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
    const before = contentsOf(prepared.root, paths);
    let note: string | undefined;
    for (const command of prepared.commands) {
        const { result, failure } = await runPlannedTool(
            command.argv,
            {
                ...prepared,
                cancelSignal: session.cancelSignal,
            },
            planned.scope.view,
            planned.check.name,
        );
        note = failure?.note ?? fixFailure(planned, result);
        if (note !== undefined) break;
    }
    const changed = changedPaths(before, contentsOf(prepared.root, paths));
    return note === undefined
        ? { check, status: changed.length === 0 ? 'unchanged' : 'changed', changed }
        : { check, status: 'failed', changed, note };
}

async function scratchFix(
    session: Session,
    planned: PlannedCheck,
    root: string,
    command: string[],
    toolPath: string,
    options: CheckRunOptions,
): Promise<FixResult> {
    const preparedScratch = await prepareInScratch({ ...session, root }, planned, command, toolPath, options);
    using scratch = preparedScratch.copy;
    const prepared = preparedScratch.prepared;
    using files = openSafeFolder(root, 'system');
    const paths = [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
    const originals = new Map(paths.map((path) => [path, files.read(path)]));
    const result = await runFix(session, planned, prepared);
    using corrected = openSafeFolder(scratch.path, 'system');
    for (const path of result.changed) {
        const original = originals.get(path);
        const value = corrected.read(path);
        if (value !== undefined) files.write(path, value, original);
        else if (original !== undefined) files.remove(path, original);
    }
    return result;
}

// The outcome of one fixer over every pass: a failure stands, and the changed files add up.
function mergedResult(first: FixResult | undefined, next: FixResult): FixResult {
    if (first === undefined) return next;
    const changed = [...new Set([...first.changed, ...next.changed])];
    if (first.status === 'failed') return { ...first, changed };
    if (next.status === 'failed') return { ...next, changed };
    return { check: next.check, status: changed.length === 0 ? next.status : 'changed', changed };
}

async function runCommandFix(
    session: Session,
    planned: PlannedCheck,
    workingDirectory: string,
    options: CheckRunOptions,
): Promise<FixResult> {
    const check = planned.check.name;
    // applyFixers selects only checks with a validated, nonempty fixer command.
    const command = planned.check.fix as string[];
    const name = command[0] as string;
    const tool =
        planned.tool?.name === name
            ? planned.tool
            : toolDeclaration(session.manifests.values(), name, planned.manifest);
    const selected = { ...planned, tool };
    const environment = commandEnvironment(session, selected, options);
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
        return scratchFix(session, selected, workingDirectory, command, availability.path, options);
    const scratchSession = { ...session, root: workingDirectory };
    const prepared = prepareCommand(
        scratchSession,
        selected,
        command,
        workingDirectory === session.root ? environment : commandEnvironment(scratchSession, selected, options),
        availability.path,
    );
    return runFix(session, planned, prepared);
}

// Canceled and inactive fixes stay outside both publication and executable preparation.
async function runFixer(
    session: Session,
    planned: PlannedCheck,
    root: string,
    checks: BuiltInChecks,
): Promise<FixResult> {
    const check = planned.check.name;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'failed', changed: [], note: 'The fix was canceled.' };
    if (planned.skip !== undefined || planned.files.length + planned.triggerPaths.length === 0)
        return { check, status: 'skipped', changed: [] };
    const builtIn = checks[check];
    if (builtIn === undefined) return runCommandFix(session, planned, root, {});
    return builtIn.fix === undefined
        ? runCommandFix(session, planned, root, {
              arguments: builtIn.arguments,
              configurationFiles: builtIn.configurationFiles,
          })
        : builtIn.fix(planned, root);
}

/**
 * Capture selected source bytes, retaining missing destinations.
 *
 * @param root the source root.
 * @param paths selected repository paths.
 *
 * @returns captured bytes or absence for each path.
 */
function contentsOf(root: string, paths: string[]): Map<string, Buffer | undefined> {
    const contents = new Map<string, Buffer | undefined>();
    for (const path of paths) {
        try {
            contents.set(path, readSource(root, path));
        } catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
            contents.set(path, undefined);
        }
    }
    return contents;
}

/**
 * Compare captured source bytes and absence.
 *
 * @param before bytes before the operation.
 * @param after bytes after the operation.
 *
 * @returns paths whose bytes or presence changed.
 */
function changedPaths(before: Map<string, Buffer | undefined>, after: Map<string, Buffer | undefined>): string[] {
    return before
        .keys()
        .filter((path) => {
            const was = before.get(path);
            const now = after.get(path);
            return was === undefined || now === undefined ? was !== now : !was.equals(now);
        })
        .toArray();
}

// Each pass after the first reruns the fixers over the files the pass before changed, so a formatter formats what a
// codemod wrote after it.
/**
 * Run selected fixers again over changed files until they settle.
 *
 * @param session the execution context.
 * @param checks the selected fixers.
 * @param root the source or scratch root.
 * @param paths the selected paths.
 * @param checksByName check implementations.
 *
 * @returns cumulative results for each fixer.
 */
async function fixerPasses(
    session: Session,
    checks: PlannedCheck[],
    root: string,
    paths: string[],
    checksByName: BuiltInChecks,
) {
    const results = new Map<number, FixResult>();
    let firstBefore: Map<string, Buffer | undefined> | undefined;
    let after = new Map<string, Buffer | undefined>();
    let pending = checks.map((check, index) => ({ check, index }));
    for (let pass = 0; pass < FIX_PASSES && pending.length > 0; pass += 1) {
        const before = contentsOf(root, paths);
        firstBefore ??= before;
        for (const { check, index } of pending)
            results.set(index, mergedResult(results.get(index), await runFixer(session, check, root, checksByName)));
        after = contentsOf(root, paths);
        const changed = new Set(changedPaths(before, after));
        pending = checks.flatMap((check, index) => {
            const files = check.files.filter((file) => changed.has(file.path) && after.get(file.path) !== undefined);
            if (files.length === 0 || results.get(index)?.status === 'failed') return [];
            return [{ check: { ...check, files, triggerPaths: [] }, index }];
        });
    }
    return { results: [...results.values()], before: firstBefore ?? after, after };
}

/**
 * Runs fixes in passes and assembles their outcomes. Dry runs always remove the scratch copy.
 *
 * @param session the session.
 * @param planned the planned checks.
 * @param options whether to run in a scratch copy and report diffs.
 *
 * @returns the fix results, changed paths, and dry-run diffs.
 */
export async function applyFixers(session: Session, planned: PlannedCheck[], options: FixOptions): Promise<FixReport> {
    const { isDryRun, checks: checksByName } = options;
    const checks = planned.filter(
        (check) => check.check.fix !== undefined || checksByName[check.check.name]?.fix !== undefined,
    );
    const paths = [
        ...new Set(checks.flatMap((check) => [...check.files.map((file) => file.path), ...check.triggerPaths])),
    ].toSorted((a, b) => a.localeCompare(b));
    using scratch = isDryRun
        ? await copyIntoScratch(
              projectCopyInputs(
                  session.root,
                  [...paths, ...session.repository.files.map((file) => file.path)],
                  session.repository.scopes.map((scope) => scope.path),
              ),
          )
        : undefined;
    const root = scratch?.path ?? session.root;
    const { before, after, results } = await fixerPasses(session, checks, root, paths, checksByName);
    const changed = changedPaths(before, after);
    const diffs = isDryRun
        ? changed.map((path) =>
              createTwoFilesPatch(
                  `a/${toPosix(path)}`,
                  `b/${toPosix(path)}`,
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
