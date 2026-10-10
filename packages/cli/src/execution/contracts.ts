import { join } from 'node:path';
import { runTool } from '#cli/tools/contracts.ts';
import { unlinkSync, writeFileSync } from 'node:fs';
import { emptyResult } from '#cli/execution/report.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { FIX_PASSES } from '#cli/config/execution/runtime.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { openRoot, readSource } from '#cli/platform/root/public.ts';
import { inspectTool, toolAvailability } from '#cli/tools/public.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import type { PreparedCommand } from '#cli/types/execution/command.ts';
import { isolatedFiles } from '#cli/execution/command/arguments/public.ts';
import { copyIntoScratch, workspaceSourceFiles } from '#cli/execution/copy/public.ts';
import { hasToolError, toolDeadline, executionFailure } from '#cli/execution/command/contracts.ts';
import { prepareCommand, runCheckCommand, commandEnvironment } from '#cli/execution/command/public.ts';

import type {
    FixRun,
    FixResult,
    CheckInput,
    Executable,
    CheckResult,
    BuiltInCheck,
    CheckOutcome,
    BuiltInChecks,
} from '#cli/types/execution/check.ts';

function fixFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    const failure = executionFailure(result, planned.check.name, planned.scope.view);
    if (failure !== undefined) return failure.note;
    // A code the check declares for findings means findings remain after the fix.
    const { check } = planned;
    if (!hasToolError(check, planned.tool, result) && (result.code === 0 || check.exit_codes !== undefined))
        return undefined;
    const detail = [result.stderr.trim(), result.stdout.trim()].filter((text) => text !== '').join('\n');
    return [`${planned.check.name} exited ${String(result.code)}`, detail].filter((text) => text !== '').join(': ');
}

async function runFix(session: ToolSession, planned: PlannedCheck, prepared: PreparedCommand): Promise<FixRun> {
    const check = planned.check.name;
    const paths = [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
    const before = contentsOf(prepared.root, paths);
    let note: string | undefined;
    for (const command of prepared.commands) {
        const result = await runTool(command.argv, {
            ...prepared,
            timeoutSeconds: toolDeadline(planned.scope.view),
            cancelSignal: session.cancelSignal,
        });
        note = fixFailure(planned, result);
        if (note !== undefined) break;
    }
    const changed = changedPaths(before, contentsOf(prepared.root, paths));
    return {
        result:
            note === undefined
                ? { check, status: changed.length === 0 ? 'unchanged' : 'changed', changed }
                : { check, status: 'failed', changed, note },
        originals: new Map(changed.map((path) => [path, before.get(path)])),
    };
}

async function isolatedFix(
    session: ToolSession,
    planned: PlannedCheck,
    root: string,
    command: string[],
    toolPath: string,
): Promise<FixResult> {
    using workspace = await copyIntoScratch({
        root: root,
        paths: isolatedFiles(session, planned, command),
        dependencies: [],
    });
    const workspaceSession = { ...session, root: workspace.path };
    const prepared = prepareCommand(
        workspaceSession,
        planned,
        command,
        commandEnvironment(workspaceSession, planned),
        toolPath,
    );
    const { result, originals } = await runFix(session, planned, prepared);
    const current = contentsOf(root, result.changed);
    const corrected = contentsOf(workspace.path, result.changed);
    using files = openRoot(root, 'native');
    // Validate every changed source before publishing any fix bytes.
    const destinations = [...originals].map(([path, original]) => {
        if (original === undefined ? current.get(path) !== undefined : current.get(path)?.equals(original) !== true)
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

async function runCommandFix(
    session: ToolSession,
    planned: PlannedCheck,
    workingDirectory: string,
): Promise<FixResult> {
    const check = planned.check.name;
    // applyFixers selects only checks with a validated, nonempty fixer command.
    const command = planned.check.fix as string[];
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
    if (planned.check.run_in_copy === true)
        return isolatedFix(session, selected, workingDirectory, command, availability.path);
    const workspaceSession = { ...session, root: workingDirectory };
    const prepared = prepareCommand(
        workspaceSession,
        selected,
        command,
        workingDirectory === session.root ? environment : commandEnvironment(workspaceSession, selected),
        availability.path,
    );
    const completed = await runFix(session, planned, prepared);
    return completed.result;
}

// Canceled and inactive fixes stay outside both native publication and executable preparation.
async function runFixer(
    session: ToolSession,
    planned: PlannedCheck,
    root: string,
    checks: BuiltInChecks,
): Promise<FixResult> {
    const check = planned.check.name;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'failed', changed: [], note: 'The fix was canceled.' };
    if (planned.skip !== undefined || planned.files.length + planned.triggerPaths.length === 0)
        return { check, status: 'skipped', changed: [] };
    const nativeFix = checks[check]?.fix;
    return nativeFix === undefined ? runCommandFix(session, planned, root) : nativeFix(planned, root);
}

// Explicit coverage must stay within the source inventory the built-in check received.
function assertCoverage(input: CheckInput, files: string[]): void {
    const allowedFiles = input.repositoryFiles ?? input.files;
    const outside = files.find((path) => !allowedFiles.some((file) => file.path === path));
    if (outside !== undefined)
        throw new Error(`The built-in check reported coverage for ${outside}, outside its supplied source inventory.`);
}

// The findings and covered files a built-in check returned, with missing help supplied by its check.
function checkResult(
    input: CheckInput,
    outcome: Finding[] | CheckOutcome,
): Pick<CheckResult, 'findings' | 'files' | 'fileCount'> {
    const result: Pick<CheckResult, 'findings' | 'files' | 'fileCount'> = {
        findings: Array.isArray(outcome) ? outcome : outcome.findings,
        fileCount: input.files.length,
    };
    if (!Array.isArray(outcome)) {
        result.files = [...new Set(outcome.files)];
        assertCoverage(input, result.files);
        result.fileCount = result.files.length;
    }
    for (const finding of result.findings) finding.help ??= input.check.help;
    return result;
}

/**
 * Capture selected native source bytes, retaining missing destinations.
 * @param root the source root
 * @param paths selected repository paths
 * @returns captured bytes or absence for each path
 */
export function contentsOf(root: string, paths: string[]): Map<string, Buffer | undefined> {
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
 * Compare captured native source bytes and absence.
 * @param before bytes before the operation
 * @param after bytes after the operation
 * @returns paths whose bytes or presence changed
 */
export function changedPaths(
    before: Map<string, Buffer | undefined>,
    after: Map<string, Buffer | undefined>,
): string[] {
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
 * @param session the execution context
 * @param checks the selected fixers
 * @param root the source or scratch root
 * @param paths the selected paths
 * @param checksByName native check implementations
 * @returns cumulative results for each fixer
 */
export async function fixerPasses(
    session: ToolSession,
    checks: PlannedCheck[],
    root: string,
    paths: string[],
    checksByName: BuiltInChecks,
): Promise<FixResult[]> {
    const results = new Map<number, FixResult>();
    let pending = checks.map((check, index) => ({ check, index }));
    for (let pass = 0; pass < FIX_PASSES && pending.length > 0; pass += 1) {
        const before = contentsOf(root, paths);
        for (const { check, index } of pending)
            results.set(index, mergedResult(results.get(index), await runFixer(session, check, root, checksByName)));
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
 * Supply execution services and selected files without exposing the repository session.
 * @param session the open session
 * @param planned the planned check with its scope and files
 * @returns the check input
 */
export function checkInput(session: ToolSession, planned: Pick<PlannedCheck, 'scope' | 'check' | 'files'>): CheckInput {
    const input: CheckInput = {
        dependencyFiles: () =>
            workspaceSourceFiles(session.root, planned.scope.scope.path, session.repository.files, session.reads),
        root: session.root,
        scope: planned.scope.scope.path,
        scopeRoot: join(session.root, planned.scope.scope.path),
        view: planned.scope.view,
        check: planned.check,
        files: planned.files,
        policyFiles: session.policyFiles,
        selection: planned.scope,
        selections: session.scopes,
        manifests: session.manifests,
        inspections: session.inspections,
        scopeEntries: session.repository.scopes,
        attributes: session.repository.attributes,
        index: session.repository.index,
        hasGit: session.repository.hasGit,
        reads: session.reads,
        ...(session.installedRoot === undefined ? {} : { installedRoot: session.installedRoot }),
        ...(session.resources === undefined ? {} : { resources: session.resources }),
        ...(session.cancelSignal === undefined ? {} : { cancelSignal: session.cancelSignal }),
    };
    if (planned.check.runs === 'once') {
        input.repositoryFiles = session.repository.files;
    }
    return input;
}

/**
 * Adapt one input-based check to the execution callback used by every built-in check.
 * @param builtInCheck the selected implementation.
 * @returns the callback that runs a planned check.
 */
export function runBuiltInCheck(builtInCheck: BuiltInCheck): Executable['run'] {
    return async (session, planned, options) => {
        const base = emptyResult(planned);
        const started = performance.now();
        const input = checkInput(session, planned);
        if (options?.staged) input.staged = options.staged;
        const outcome = await builtInCheck(input);
        const result = checkResult(input, outcome);
        return {
            ...base,
            ...result,
            status: result.findings.length > 0 ? 'failed' : 'passed',
            duration: performance.now() - started,
        };
    };
}

/**
 * Select an implementation before execution starts.
 * @param check the selected check definition
 * @param checks the checks gspot runs itself
 * @returns the function that runs the check
 */
export function checkRun(check: CheckDeclaration, checks: BuiltInChecks): Executable['run'] {
    const implementation = checks[check.name];
    if (implementation !== undefined) return implementation.run;
    if (check.command === undefined) {
        throw new Error(`The check ${check.name} names no command, and gspot has no built-in check by that name.`);
    }
    return runCheckCommand;
}
