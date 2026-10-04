// Fixes run in passes until they settle; dry runs use a scratch copy and return diffs.
import { createTwoFilesPatch } from 'diff';
import { runTool } from '#cli/tools/run.ts';
import { toolPin } from '#cli/tools/pins.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { unlinkSync, writeFileSync } from 'node:fs';
import { readSource } from '#cli/platform/source.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { inspectTool, toolAvailability } from '#cli/tools/inspect.ts';
import type { PreparedCommand } from '#cli/types/execution/command.ts';
import { isolatedFiles } from '#cli/execution/command/placeholders.ts';
import { prepareCommand, commandEnvironment } from '#cli/execution/command/runner.ts';
import { scratchCopy, createFileWorkspace } from '#cli/execution/snapshot/workspace.ts';
import { hasToolError, toolDeadline, executionFailure } from '#cli/execution/command/failures.ts';
import { FIX_PASSES, FIX_DIFF_CONTEXT, FINDING_EXIT_CODES } from '#cli/config/execution/runtime.ts';
import type { FixReport, FixResult, FixOptions, PlannedCheck } from '#cli/types/execution/runtime.ts';

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

function fixFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    const failure = executionFailure(result, planned.spec.name, planned.scope.view);
    if (failure !== undefined) return failure.note;
    // A code the check declares for findings means findings remain after the fix.
    const { spec } = planned;
    const findingCodes = [spec.exit_codes, FINDING_EXIT_CODES.get(spec.output?.format)].flat();
    if ((result.code === 0 || findingCodes.includes(result.code)) && !hasToolError(spec, planned.tool, result))
        return undefined;
    const detail = [result.stderr.trim(), result.stdout.trim()].filter((text) => text !== '').join('\n');
    return [`${planned.spec.name} exited ${String(result.code)}`, detail].filter((text) => text !== '').join(': ');
}

async function runFix(session: Session, planned: PlannedCheck, prepared: PreparedCommand): Promise<FixResult> {
    const check = planned.spec.name;
    const paths = [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
    const before = contentsOf(prepared.root, paths);
    for (const command of prepared.commands) {
        const result = await runTool(command.argv, {
            ...prepared,
            timeoutSeconds: toolDeadline(planned.scope.view),
            cancelSignal: session.cancelSignal,
        });
        const note = fixFailure(planned, result);
        if (note !== undefined) {
            return {
                check,
                status: 'failed',
                changed: changedPaths(before, contentsOf(prepared.root, paths)),
                note,
            };
        }
    }
    const changed = changedPaths(before, contentsOf(prepared.root, paths));
    return { check, status: changed.length === 0 ? 'unchanged' : 'changed', changed };
}

async function isolatedFix(
    session: Session,
    planned: PlannedCheck,
    root: string,
    command: string[],
    toolPath: string,
): Promise<FixResult> {
    using workspace = createFileWorkspace(root, isolatedFiles(session, planned, command));
    const workspaceSession = { ...session, root: workspace.root };
    const prepared = prepareCommand(
        workspaceSession,
        planned,
        command,
        commandEnvironment(workspaceSession, planned),
        toolPath,
    );
    const result = await runFix(session, planned, prepared);
    const current = contentsOf(root, result.changed);
    const corrected = contentsOf(workspace.root, result.changed);
    using files = openRoot(root, 'native');
    // Validate every changed source before publishing any fix bytes.
    const destinations = [...workspace.originals]
        .filter(([path]) => result.changed.includes(path))
        .map(([path, original]) => {
            if (current.get(path)?.equals(original) !== true)
                throw new Error(`${path} changed while its fix was running; the isolated fix was not applied.`);
            return [path, files.realPath(path)] as const;
        });
    for (const [path, destination] of destinations) {
        const bytes = corrected.get(path);
        if (bytes === undefined) unlinkSync(destination);
        else writeFileSync(destination, bytes);
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

// Each pass after the first reruns the fixers over the files the pass before changed, so a formatter formats what a
// codemod wrote after it.
async function fixerPasses(
    session: Session,
    checks: PlannedCheck[],
    root: string,
    paths: string[],
): Promise<FixResult[]> {
    const results = new Map<number, FixResult>();
    let pending = checks.map((check, index) => ({ check, index }));
    for (let pass = 0; pass < FIX_PASSES && pending.length > 0; pass += 1) {
        const before = contentsOf(root, paths);
        for (const { check, index } of pending)
            results.set(index, mergedResult(results.get(index), await runFixer(session, check, root)));
        const after = contentsOf(root, paths);
        const changed = new Set(changedPaths(before, after));
        pending = checks.flatMap((check, index) => {
            const files = check.files.filter((file) => changed.has(file.path) && after.get(file.path) !== undefined);
            if (files.length === 0 || results.get(index)?.status === 'failed') return [];
            return [{ check: { ...check, files, triggerPaths: [] }, index }];
        });
    }
    return [...results.values()];
}

/**
 * Runs one fix and determines its outcome from process status and resulting bytes.
 * @param session the repository session
 * @param planned the fix and its selected files
 * @param workingDirectory the repository or scratch root
 * @returns the fix outcome, including changes made before a failure
 */
async function runFixer(session: Session, planned: PlannedCheck, workingDirectory: string): Promise<FixResult> {
    const check = planned.spec.name;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'failed', changed: [], note: 'The fix was canceled.' };
    if (planned.skip !== undefined || planned.files.length + planned.triggerPaths.length === 0)
        return { check, status: 'skipped', changed: [] };
    // applyFixers selects only checks with a validated, nonempty fixer command.
    const command = planned.spec.fix as string[];
    const name = command[0] as string;
    const tool = toolPin(session.manifests.values(), name, planned.manifest, planned.tool);
    const selected = { ...planned, tool };
    const environment = commandEnvironment(session, selected);
    const { env, cwd } = environment;
    const inspection = inspectTool({ ...session, cwd }, { ...tool, env });
    const availability = toolAvailability(tool, inspection);
    if ('status' in availability)
        return {
            check,
            status: 'failed',
            changed: [],
            note: availability.note,
        };
    if (planned.spec.run_in_copy === true)
        return isolatedFix(session, selected, workingDirectory, command, availability.path);
    const workspaceSession = { ...session, root: workingDirectory };
    const prepared = prepareCommand(
        workspaceSession,
        selected,
        command,
        workingDirectory === session.root ? environment : commandEnvironment(workspaceSession, selected),
        availability.path,
    );
    return runFix(session, planned, prepared);
}

/**
 * Runs fixes in passes and assembles their outcomes. Dry runs always remove the scratch copy.
 * @param session the session
 * @param planned the planned checks
 * @param options whether to run in a scratch copy and report diffs
 * @returns the fix results, changed paths, and dry-run diffs
 */
export async function applyFixers(session: Session, planned: PlannedCheck[], options: FixOptions): Promise<FixReport> {
    const { isDryRun } = options;
    const checks = planned.filter((check) => check.spec.fix !== undefined);
    const paths = [
        ...new Set(checks.flatMap((check) => [...check.files.map((file) => file.path), ...check.triggerPaths])),
    ].toSorted((a, b) => a.localeCompare(b));
    using scratch = isDryRun
        ? await scratchCopy(
              session.root,
              [...paths, ...session.repository.files.map((file) => file.path)],
              session.repository.scopes.map((scope) => scope.path),
          )
        : undefined;
    const root = scratch?.path ?? session.root;
    const before = contentsOf(root, paths);
    const results = await fixerPasses(session, checks, root, paths);
    const after = contentsOf(root, paths);
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
