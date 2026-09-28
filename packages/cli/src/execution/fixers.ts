import { createTwoFilesPatch } from 'diff';
import { toPlatform } from '#cli/platform/paths.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { inspectTool, toolPin } from '#cli/tools/inspect.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { prepareCommand } from '#cli/execution/tool/runner.ts';
import type { ConfinedRoot, SpawnResult } from '#cli/types/platform.ts';
// Corrections run in order; dry runs use a scratch copy and return diffs.
import { readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { commandConfigurations } from '#cli/execution/command-expansion.ts';
import { runToolCommand, toolDeadlineSeconds } from '#cli/tools/command.ts';
import { executionFailure, hasToolError } from '#cli/execution/broken-tool.ts';
import { FIX_DIFF_CONTEXT, FIX_ORDER } from '#cli/constants/execution/execution.ts';
import { createFileWorkspace, scratchCopy } from '#cli/execution/files/workspace.ts';
import type { FixReport, FixResult, PlannedCheck, PreparedCommand, Session } from '#cli/types/execution/execution.ts';

function sourceBytes(files: ConfinedRoot, path: string): Buffer | undefined {
    try {
        return readFileSync(files.source(path));
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        return undefined;
    }
}

function contentsOf(root: string, paths: string[]): Map<string, Buffer | undefined> {
    const files = openConfinedRoot(root, 'native');
    try {
        return new Map(paths.map((path) => [path, sourceBytes(files, path)]));
    } finally {
        files.close();
    }
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

function correctionTool(session: Session, plannedCheck: PlannedCheck): ToolPin | undefined {
    const name = plannedCheck.spec.fix_command?.[0];
    if (name === undefined) return undefined;
    if (plannedCheck.tool?.name === name) return plannedCheck.tool;
    return toolPin(session.manifests.values(), name);
}

function correctionFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    const failure = executionFailure(result, planned.check, toolDeadlineSeconds(planned.scope.view));
    if (failure !== undefined) return failure.note;
    const hasRemainingFindings = planned.spec.fix_findings_exit_codes?.includes(result.code) === true;
    if ((result.code === 0 || hasRemainingFindings) && !hasToolError(planned.spec, planned.tool, result))
        return undefined;
    const detail = [result.stderr.trim(), result.stdout.trim()].filter((text) => text !== '').join('\n');
    return [`${planned.check} exited ${String(result.code)}`, detail].filter((text) => text !== '').join(': ');
}

async function runCorrection(
    session: Session,
    plannedCheck: PlannedCheck,
    prepared: PreparedCommand,
): Promise<FixResult> {
    const check = plannedCheck.check;
    const paths = [...new Set([...plannedCheck.files.map((file) => file.path), ...plannedCheck.triggerPaths])];
    const before = contentsOf(prepared.root, paths);
    for (const command of prepared.commands) {
        const result = await runToolCommand(plannedCheck.scope.view, command.argv, prepared, session.cancelSignal);
        const note = correctionFailure(plannedCheck, result);
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

async function isolatedCorrection(
    session: Session,
    planned: PlannedCheck,
    root: string,
    command: string[],
    toolPath: string,
): Promise<FixResult> {
    using workspace = createFileWorkspace(root, [
        ...planned.files.map(({ path }) => path),
        ...commandConfigurations(session, planned, command),
    ]);
    const prepared = prepareCommand({ ...session, root: workspace.root }, planned, command, toolPath);
    const result = await runCorrection(session, planned, prepared);
    const current = contentsOf(root, result.changed);
    const corrected = contentsOf(workspace.root, result.changed);
    const files = openConfinedRoot(root, 'native');
    try {
        // Validate every changed source before publishing any correction bytes.
        const destinations = [...workspace.originals]
            .filter(([path]) => result.changed.includes(path))
            .map(([path, original]) => {
                if (current.get(path)?.equals(original) !== true)
                    throw new Error(
                        `${path} changed while its correction was running; the isolated correction was not applied.`,
                    );
                return [path, files.source(path)] as const;
            });
        for (const [path, destination] of destinations) {
            const bytes = corrected.get(path);
            if (bytes === undefined) unlinkSync(destination);
            else writeFileSync(destination, bytes);
        }
    } finally {
        files.close();
    }
    return result;
}

async function executeCorrection(
    session: Session,
    plannedCheck: PlannedCheck,
    workingDirectory: string,
    command: string[],
    tool: ToolPin,
): Promise<FixResult> {
    const check = plannedCheck.check;
    const { env, cwd } = prepareCommand(session, { ...plannedCheck, tool }, command);
    const inspection = inspectTool({ ...session, cwd }, { ...tool, env });
    if (inspection.path === undefined || ['missing', 'outdated', 'error'].includes(inspection.state))
        return {
            check,
            status: 'failed',
            changed: [],
            note:
                inspection.note ?? `${tool.name} is unavailable. ${inspection.hint ?? 'Install the configured tool.'}`,
        };
    if (plannedCheck.spec.isolated_files === true)
        return isolatedCorrection(session, plannedCheck, workingDirectory, command, inspection.path);
    const prepared = prepareCommand({ ...session, root: workingDirectory }, plannedCheck, command, inspection.path);
    return runCorrection(session, plannedCheck, prepared);
}

/**
 * Runs one correction and determines its outcome from process status and resulting bytes.
 * @param session the repository session
 * @param plannedCheck the correction and its selected files
 * @param workingDirectory the repository or scratch root
 * @returns the correction outcome, including changes made before a failure
 */
export async function runFixer(
    session: Session,
    plannedCheck: PlannedCheck,
    workingDirectory: string,
): Promise<FixResult> {
    if (session.cancelSignal?.aborted === true)
        return { check: plannedCheck.check, status: 'failed', changed: [], note: 'The correction was canceled.' };
    const { spec } = plannedCheck;
    const tool = correctionTool(session, plannedCheck);
    const check = plannedCheck.check;
    if (
        spec.fix_command === undefined ||
        plannedCheck.skip !== undefined ||
        (plannedCheck.files.length === 0 && plannedCheck.triggerPaths.length === 0)
    )
        return { check, status: 'skipped', changed: [] };
    if (tool === undefined) return { check, status: 'failed', changed: [], note: 'No correction tool is configured.' };
    return executeCorrection(session, plannedCheck, workingDirectory, spec.fix_command, tool);
}

/**
 * Runs corrections in order and assembles their outcomes. Dry runs always remove the scratch copy.
 * @param session the session
 * @param planned the planned checks
 * @param isDryRun whether to run in a scratch copy and report diffs
 * @returns the correction results, changed paths, and dry-run diffs
 */
export async function applyFixers(session: Session, planned: PlannedCheck[], isDryRun: boolean): Promise<FixReport> {
    const checks = planned
        .filter((check) => check.spec.fix_command !== undefined)
        .toSorted(
            (a, b) => FIX_ORDER.indexOf(a.spec.fix_order ?? 'format') - FIX_ORDER.indexOf(b.spec.fix_order ?? 'format'),
        );
    const paths = [
        ...new Set(checks.flatMap((check) => [...check.files.map((file) => file.path), ...check.triggerPaths])),
    ].toSorted((a, b) => a.localeCompare(b));
    const scratch = isDryRun
        ? scratchCopy(
              session.root,
              [...paths, ...session.repository.files.map((file) => file.path)],
              session.repository.scopes.map((scope) => scope.path),
          )
        : undefined;
    const root = scratch ?? session.root;
    try {
        const before = contentsOf(root, paths);
        const results: FixResult[] = [];
        for (const check of checks) results.push(await runFixer(session, check, root));
        const after = contentsOf(root, paths);
        const changed = changedPaths(before, after);
        const diffs = isDryRun
            ? changed.map((path) =>
                  createTwoFilesPatch(
                      `a/${toPlatform(path)}`,
                      `b/${toPlatform(path)}`,
                      before.get(path)?.toString('utf8') ?? '',
                      after.get(path)?.toString('utf8') ?? '',
                      '',
                      '',
                      { context: FIX_DIFF_CONTEXT },
                  ),
              )
            : [];
        return { results, changed, diffs };
    } finally {
        if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
    }
}
