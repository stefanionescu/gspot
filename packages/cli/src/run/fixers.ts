// Corrections run in order; dry runs use a scratch copy and return diffs.
import { join } from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { readFileSync, rmSync } from 'node:fs';
import type { ToolPin } from '#types/manifest.ts';
import { toPlatform } from '#cli/platform/paths.ts';
import { byFixOrder } from '#cli/run/concurrency.ts';
import { scratchCopy } from '#cli/run/scratch-copy.ts';
import { probeTool, toolPin } from '#cli/platform/tool-probe.ts';
import { prepareCommand, runToolCommand } from '#cli/run/tool-runner.ts';
import type { FixReport, FixResult, Session, PlannedCheck, PreparedCommand } from '#types/run.ts';

const DIFF_CONTEXT = 3;

function contentsOf(root: string, paths: string[]): Map<string, Buffer | undefined> {
    const contents = new Map<string, Buffer | undefined>();
    for (const path of paths) {
        try {
            contents.set(path, readFileSync(join(root, path)));
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

function isSkipped(plannedCheck: PlannedCheck): boolean {
    return (
        plannedCheck.skip !== undefined || (plannedCheck.files.length === 0 && plannedCheck.triggerPaths.length === 0)
    );
}

function correctionTool(session: Session, plannedCheck: PlannedCheck): ToolPin | undefined {
    const name = plannedCheck.spec.fix_command?.[0];
    if (name === undefined) return undefined;
    if (plannedCheck.tool?.name === name) return plannedCheck.tool;
    return toolPin(session.manifests.values(), name);
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
        const result = await runToolCommand(plannedCheck.scope.view, command, prepared, session.cancelSignal);
        if (result.code !== 0 || result.missing || result.isTimedOut === true) {
            const detail = [result.stderr.trim(), result.stdout.trim()].filter((text) => text !== '').join('\n');
            return {
                check,
                status: 'failed',
                changed: changedPaths(before, contentsOf(prepared.root, paths)),
                note: [`${check} exited ${String(result.code)}`, detail].filter((text) => text !== '').join(': '),
            };
        }
    }
    const changed = changedPaths(before, contentsOf(prepared.root, paths));
    return { check, status: changed.length === 0 ? 'unchanged' : 'changed', changed };
}

function diffOf(path: string, was: Buffer | undefined, now: Buffer | undefined): string {
    return createTwoFilesPatch(
        `a/${toPlatform(path)}`,
        `b/${toPlatform(path)}`,
        was?.toString('utf8') ?? '',
        now?.toString('utf8') ?? '',
        '',
        '',
        {
            context: DIFF_CONTEXT,
        },
    );
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
    if (spec.fix_command === undefined || isSkipped(plannedCheck)) return { check, status: 'skipped', changed: [] };
    if (tool === undefined) return { check, status: 'failed', changed: [], note: 'No correction tool is configured.' };
    const { env, cwd } = prepareCommand(session, { ...plannedCheck, tool }, spec.fix_command);
    const probe = probeTool({ ...session, cwd }, { ...tool, env });
    if (probe.path === undefined || ['missing', 'outdated', 'error'].includes(probe.state))
        return {
            check,
            status: 'failed',
            changed: [],
            note: probe.note ?? `${tool.name} is unavailable. Run: ${probe.hint ?? 'install the configured tool'}`,
        };
    const prepared = prepareCommand({ ...session, root: workingDirectory }, plannedCheck, spec.fix_command, probe.path);
    return runCorrection(session, plannedCheck, prepared);
}

/**
 * Runs corrections in order and assembles their outcomes. Dry runs always remove the scratch copy.
 * @param session the session
 * @param planned the planned checks
 * @param isDryRun whether to run in a scratch copy and report diffs
 * @returns the correction results, changed paths, and dry-run diffs
 */
export async function applyFixers(session: Session, planned: PlannedCheck[], isDryRun: boolean): Promise<FixReport> {
    const checks = byFixOrder(
        planned
            .filter((check) => check.spec.fix_command !== undefined)
            .map((check) => ({ ...check, order: check.spec.fix_order })),
    );
    const paths = [
        ...new Set(checks.flatMap((check) => [...check.files.map((file) => file.path), ...check.triggerPaths])),
    ].toSorted((a, b) => a.localeCompare(b));
    const scratch = isDryRun ? scratchCopy(session, paths) : undefined;
    const root = scratch ?? session.root;
    try {
        const before = contentsOf(root, paths);
        const results: FixResult[] = [];
        for (const check of checks) results.push(await runFixer(session, check, root));
        const after = contentsOf(root, paths);
        const changed = changedPaths(before, after);
        const diffs = isDryRun ? changed.map((path) => diffOf(path, before.get(path), after.get(path))) : [];
        return { results, changed, diffs };
    } finally {
        if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
    }
}
