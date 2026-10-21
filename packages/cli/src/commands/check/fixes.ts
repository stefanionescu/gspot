import { createTwoFilesPatch } from 'diff';
import { findCheckCode } from '#cli/checks/code.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { isReportedCrash } from '#cli/runs/command/output.ts';
import type { CheckRunOptions } from '#cli/types/runs/check.ts';
import type { GrammarName } from '#cli/types/parsers/grammars.ts';
import type { PreparedCommand } from '#cli/types/runs/command.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { findTool, runToolProcess } from '#cli/runs/command/tool.ts';
import { createCopy, selectCopyPaths } from '#cli/runs/copy/files.ts';
import { FIX_ROUNDS, FIX_DIFF_CONTEXT } from '#cli/config/runs/fixes.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/grammars.ts';
import type { FixReport, FixResult, FixOptions } from '#cli/types/runs/fixes.ts';
import { copyCheckFiles, prepareCommand, prepareCommandIn, prepareToolEnvironment } from '#cli/runs/command/check.ts';

function findFixFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    // A code the check declares for findings means findings remain after the fix.
    const { check } = planned;
    if (!isReportedCrash(check, planned.tool, result) && (result.code === 0 || check.exit_codes !== undefined))
        return undefined;
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n');
    return detail === '' ? `${planned.check.id} exited ${String(result.code)}` : detail;
}

async function runFixCommands(
    planned: PlannedCheck,
    prepared: PreparedCommand,
    cancelSignal: AbortSignal | undefined,
): Promise<FixResult> {
    const check = planned.check.id;
    const paths = [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
    const before = readContents(prepared.root, paths);
    let note: string | undefined;
    for (const command of prepared.commandLines) {
        const { result, failure } = await runToolProcess(command.commandArguments, {
            ...prepared,
            cancelSignal,
            timeoutSeconds: Number(planned.scope.settings.settings['tool_timeout_seconds']),
            name: planned.check.id,
        });
        note = failure?.note ?? findFixFailure(planned, result);
        if (note !== undefined) break;
    }
    const changed = listChangedPaths(before, readContents(prepared.root, paths));
    return note === undefined
        ? { check, status: changed.length === 0 ? 'unchanged' : 'changed', changed }
        : { check, status: 'failed', changed, note };
}

async function runFixInCopy(
    planned: PlannedCheck,
    {
        session,
        root,
        command,
        toolPath,
        options,
    }: { session: Session; root: string; command: string[]; toolPath: string; options: CheckRunOptions },
): Promise<FixResult> {
    using scratch = await copyCheckFiles(planned, { session: { ...session, root }, command, options });
    const prepared = prepareCommandIn(scratch.path, planned, { session, command, toolPath, options });
    using files = openFiles(root);
    const paths = [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
    const originals = new Map(paths.map((path) => [path, files.read(path)]));
    const result = await runFixCommands(planned, prepared, session.cancelSignal);
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

// A canceled or skipped fix returns before it finds the tool or writes files.
async function runFixer(session: Session, planned: PlannedCheck, root: string): Promise<FixResult> {
    const check = planned.check.id;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'failed', changed: [], note: 'The fix was canceled.' };
    if (planned.skip !== undefined || planned.files.length + planned.triggerPaths.length === 0)
        return { check, status: 'skipped', changed: [] };
    const options: CheckRunOptions = { ...findCheckCode(planned.check) };
    // runFixers selects only checks with a validated, nonempty fixer command.
    const command = planned.check.fix as string[];
    const name = command[0] as string;
    const { tool, setup } = prepareToolEnvironment(session, planned, name, options);
    const selected = { ...planned, tool };
    const availability = findTool(session, setup.cwd, tool);
    if ('status' in availability) return { check, status: 'failed', changed: [], note: availability.note };
    if (planned.check.run_in_copy === true)
        return runFixInCopy(selected, { session, root, command, toolPath: availability.path, options });
    const prepared =
        root === session.root
            ? prepareCommand(selected, { session, command, setup, toolPath: availability.path })
            : prepareCommandIn(root, selected, { session, command, toolPath: availability.path, options });
    return runFixCommands(planned, prepared, session.cancelSignal);
}

/**
 * Reads the bytes of each path, with undefined for a missing file.
 *
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
            if (!hasErrorCode(error, 'ENOENT')) throw error;
            contents.set(path, undefined);
        }
    }
    return contents;
}

/**
 * Lists the paths whose bytes changed, appeared, or disappeared.
 *
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
 *
 * @param session the repository and its tools.
 * @param checks the fixers to run.
 * @param sourceRoot the folder that the fixers change.
 * @param paths the files to compare between rounds.
 * @returns each fixer result, and the file bytes before and after.
 */
async function runFixerRounds(
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
    for (let round = 0; round < FIX_ROUNDS && pending.length > 0; round += 1) {
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

async function hasSyntaxError(grammar: GrammarName, bytes: Buffer): Promise<boolean> {
    const tree = await parseSource(grammar, bytes.toString('utf8'));
    try {
        return tree.rootNode.hasError;
    } finally {
        tree.delete();
    }
}

async function listBrokenSyntax(
    changed: string[],
    before: Map<string, Buffer | undefined>,
    after: Map<string, Buffer | undefined>,
): Promise<string[]> {
    const checked = await Promise.all(
        changed.map(async (path) => {
            const grammar = findGrammarByExtension(path);
            if (grammar === undefined) return [];
            const was = before.get(path);
            const now = after.get(path);
            if (was === undefined || now === undefined) return [];
            const isBroken = !(await hasSyntaxError(grammar, was)) && (await hasSyntaxError(grammar, now));
            return isBroken ? [path] : [];
        }),
    );
    return checked.flat();
}

/**
 * Runs fixes in rounds and collects their results. A dry run always removes its copy.
 *
 * @param session the repository and its tools.
 * @param planned the checks to fix.
 * @param options whether to run in a copy and report diffs.
 * @returns the fix results, changed paths, and dry-run diffs.
 */
export async function runFixers(session: Session, planned: PlannedCheck[], options: FixOptions): Promise<FixReport> {
    const { isDryRun } = options;
    const checks = planned.filter((check) => check.check.fix !== undefined);
    const paths = [
        ...new Set(
            checks.flatMap((check) => [...new Set([...check.files.map((file) => file.path), ...check.triggerPaths])]),
        ),
    ].toSorted((a, b) => a.localeCompare(b));
    using scratch = isDryRun
        ? await createCopy(
              selectCopyPaths(
                  session.root,
                  [...paths, ...session.repository.files.map((file) => file.path)],
                  session.repository.scopeFolders.map((scope) => scope.path),
              ),
          )
        : undefined;
    const root = scratch?.path ?? session.root;
    const { before, after, results } = await runFixerRounds(session, checks, root, paths);
    const changed = listChangedPaths(before, after);
    const broken = await listBrokenSyntax(changed, before, after);
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
    return { results, changed, broken, diffs };
}
