import { compareText } from '#cli/system/text.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { buildDiff } from '#cli/apply/files/outdated.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { isReportedCrash } from '#cli/runs/command/output.ts';
import type { CheckRunOptions } from '#cli/types/runs/check.ts';
import type { CommandLaunch } from '#cli/types/runs/command.ts';
import { FIX_ROUNDS } from '#cli/config/commands/check/fixes.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { findTool, runToolProcess } from '#cli/runs/command/tool.ts';
import { createCopy, selectCopyPaths } from '#cli/runs/copy/files.ts';
import type { GrammarName } from '#cli/types/parsers/code/grammars.ts';
import type { FixReport, FixResult, FixOptions } from '#cli/types/runs/fixes.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/code/grammars.ts';
import { copyCheckFiles, prepareCommand, prepareCommandIn, prepareToolEnvironment } from '#cli/runs/command/check.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function listFixPaths(planned: PlannedCheck): string[] {
    return [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
}

function findFixFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    const { check } = planned;
    if (!isReportedCrash(check, planned.tool, result) && (result.code === 0 || check.exit_codes !== undefined))
        return undefined;
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n');
    return detail === '' ? `${planned.check.id} exited ${String(result.code)}` : detail;
}

async function runFixCommands(
    planned: PlannedCheck,
    setup: CommandLaunch,
    cancelSignal: AbortSignal | undefined,
): Promise<FixResult> {
    const check = planned.check.id;
    const paths = listFixPaths(planned);
    const before = readContents(setup.root, paths);
    let note: string | undefined;
    for (const command of setup.commandLines) {
        const { result, failure } = await runToolProcess(command.commandArguments, {
            ...setup,
            cancelSignal,
            timeoutSeconds: Number(planned.scope.settings.settings['tool_timeout_seconds']),
            name: planned.check.id,
        });
        note = failure?.note ?? findFixFailure(planned, result);
        if (note !== undefined) break;
    }
    const changed = listChangedPaths(before, readContents(setup.root, paths));
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
    const setup = prepareCommandIn(scratch.path, planned, { session, command, toolPath, options });
    using files = openFiles(root);
    const paths = listFixPaths(planned);
    const originals = new Map(paths.map((path) => [path, files.read(path)]));
    const result = await runFixCommands(planned, setup, session.cancelSignal);
    using corrected = openFiles(scratch.path);
    for (const path of result.changed) {
        const original = originals.get(path);
        const value = corrected.read(path);
        if (value !== undefined) files.write(path, value, original);
        else if (original !== undefined) files.deleteFile(path, original);
    }
    return result;
}

function mergeResults(first: FixResult | undefined, next: FixResult): FixResult {
    if (first === undefined) return next;
    const changed = [...new Set([...first.changed, ...next.changed])];
    if (first.status === 'failed') return { ...first, changed };
    if (next.status === 'failed') return { ...next, changed };
    return { check: next.check, status: changed.length === 0 ? next.status : 'changed', changed };
}

async function runFixer(session: Session, planned: PlannedCheck, root: string): Promise<FixResult> {
    const check = planned.check.id;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'failed', changed: [], note: 'The fix was canceled.' };
    if (planned.skip !== undefined || planned.files.length + planned.triggerPaths.length === 0)
        return { check, status: 'skipped', changed: [] };
    const options: CheckRunOptions = { ...findCheckCode(planned.check) };
    const command = planned.check.fix as string[];
    const name = command[0] as string;
    const { tool, setup } = prepareToolEnvironment(session, planned, name, options);
    const selected = { ...planned, tool };
    const availability = findTool(session, setup.cwd, tool);
    if ('status' in availability) return { check, status: 'failed', changed: [], note: availability.note };
    if (planned.check.run_in_copy === true)
        return runFixInCopy(selected, { session, root, command, toolPath: availability.path, options });
    const fixSetup =
        root === session.root
            ? prepareCommand(selected, { session, command, setup, toolPath: availability.path })
            : prepareCommandIn(root, selected, { session, command, toolPath: availability.path, options });
    return runFixCommands(planned, fixSetup, session.cancelSignal);
}

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
            return files.length === 0 || results.get(index)?.status === 'failed'
                ? []
                : { check: { ...check, files, triggerPaths: [] }, index };
        });
    }
    return { results: results.values().toArray(), before: firstBefore ?? after, after };
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
Runs fixes in passes and collects their results. A dry run always removes its copy.

@param session the repository and its tools.
@param planned the checks to fix.
@param options whether to run in a copy and report diffs.
@returns the fix results, changed paths, and dry-run diffs.
*/
export async function runFixers(session: Session, planned: PlannedCheck[], options: FixOptions): Promise<FixReport> {
    const { isDryRun } = options;
    const checks = planned.filter((check) => check.check.fix !== undefined);
    const paths = [...new Set(checks.flatMap((check) => listFixPaths(check)))].toSorted((a, b) => compareText(a, b));
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
              buildDiff(path, before.get(path)?.toString('utf8') ?? '', after.get(path)?.toString('utf8') ?? '', [
                  '',
                  '',
              ]),
          )
        : [];
    return { results, changed, broken, diffs };
}
