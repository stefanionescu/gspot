import { compareText } from '#cli/system/text.ts';
import { CHECK_CODE } from '#cli/checks/registry.ts';
import { createCopy } from '#cli/runs/copy/files.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { type Tool } from '#cli/types/configurations.ts';
import { runToolProcess } from '#cli/runs/command/tool.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { isReportedCrash } from '#cli/runs/command/output.ts';
import { type FileContents } from '#cli/types/system/files.ts';
import { type CheckRunOptions } from '#cli/types/runs/check.ts';
import { type CommandLaunch } from '#cli/types/runs/command.ts';
import { listCopyFiles } from '#cli/runs/command/placeholders.ts';
import { type SpawnResult } from '#cli/types/system/processes.ts';
import { type GrammarName } from '#cli/types/parsers/code/grammars.ts';
import { type Session, type CheckSession } from '#cli/types/session.ts';
import { checkGeneratorOutputs } from '#cli/checks/generator-outputs.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { prepareCommand, buildCommandSetup } from '#cli/runs/command/check.ts';
import { parseSource, findGrammarByExtension } from '#cli/parsers/code/grammars.ts';
import { FIX_ROUNDS, FIX_CANCELED_MESSAGE } from '#cli/config/commands/check/fixes.ts';
import { type FixReport, type FixResult, type FixRounds, type PathBytes } from '#cli/types/commands/check.ts';

function findFixFailure(planned: PlannedCheck, result: SpawnResult): string | undefined {
    const { check } = planned;
    if (!isReportedCrash(check, planned.tool, result) && (result.code === 0 || check.exit_codes !== undefined))
        return undefined;
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n');
    return detail === '' ? `${planned.check.id} exited ${String(result.code)}` : detail;
}

async function runFixCommands(session: Session, planned: PlannedCheck, setup: CommandLaunch): Promise<FixResult> {
    const check = planned.check.id;
    const paths = [...new Set([...planned.files.map((file) => file.path), ...planned.triggerPaths])];
    const before = readContents(setup.root, paths);
    let note: string | undefined;
    for (const command of setup.commandLines) {
        const { result, failure } = await runToolProcess(command.commandArguments, {
            ...setup,
            cancelSignal: session.cancelSignal,
            timeoutSeconds: session.timeoutSeconds,
            name: planned.check.id,
        });
        note = failure?.note ?? findFixFailure(planned, result);
        if (note !== undefined) break;
    }
    const changed = listChangedPaths(before, readContents(setup.root, paths));
    return buildFixResult(check, changed, note, session.cancelSignal);
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
    using scratch = await createCopy({
        root: root,
        paths: [...listCopyFiles(session, planned, command), ...(options.listConfigFiles?.(session, planned) ?? [])],
        dependencies: [],
        cancelSignal: session.cancelSignal,
    });
    const setup = prepareCommand(planned, {
        session: session,
        command: command,
        setup: buildCommandSetup(session, planned, { options: options, root: scratch.path }),
        toolPath: toolPath,
    });
    const files = openFiles(root);
    const result = await runFixCommands(session, planned, setup);
    const corrected = openFiles(scratch.path);
    for (const path of result.changed) {
        const value = corrected.read(path);
        if (value === undefined) files.deleteFile(path);
        else files.write(path, value);
    }
    return result;
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
    { root, command, tool }: { root: string; command: string[]; tool: Tool },
): Promise<FixResult> {
    const code =
        planned.check.generator_outputs === undefined ? CHECK_CODE[planned.check.id] : { check: checkGeneratorOutputs };
    const options: CheckRunOptions = {
        listFileArguments: code?.listFileArguments,
        listConfigFiles: code?.listConfigFiles,
    };
    const selected = { ...planned, tool };
    const setup = buildCommandSetup(session, selected, { options, root: session.root });
    const availability = buildToolAvailability(
        tool,
        inspectTool({ ...session, cwd: setup.cwd, miseBinPaths: session.readMiseBinPaths() }, tool),
    );
    if ('status' in availability)
        return { check: planned.check.id, status: 'failed', changed: [], note: availability.note };
    const toolPath = availability.path;
    if (planned.check.run_in_copy === true)
        return runFixInCopy(selected, { session, root, command, toolPath, options });
    const fixSetup =
        root === session.root
            ? prepareCommand(selected, { session, command, setup, toolPath })
            : prepareCommand(selected, {
                  session: session,
                  command: command,
                  setup: buildCommandSetup(session, selected, { options: options, root: root }),
                  toolPath: toolPath,
              });
    return runFixCommands(session, selected, fixSetup);
}

async function runFixer(session: CheckSession, planned: PlannedCheck, root: string): Promise<FixResult> {
    const check = planned.check.id;
    if (session.cancelSignal?.aborted === true)
        return { check, status: 'canceled', changed: [], note: FIX_CANCELED_MESSAGE };
    if (planned.skip !== undefined || planned.files.length + planned.triggerPaths.length === 0)
        return { check, status: 'skipped', changed: [] };
    const command = planned.check.fix as string[];
    const name = command[0] as string;
    const tool = planned.tool?.name === name ? planned.tool : getTool(session.configurationsByName.values(), name);
    return runFixTool(session, planned, { root, command, tool });
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
            results.set(index, mergeResults(results.get(index), await runFixer(session, check, session.root)));
            fixedContents.set(
                index,
                readContents(session.root, [
                    ...new Set([
                        ...(checks[index] as PlannedCheck).files.map((file) => file.path),
                        ...(checks[index] as PlannedCheck).triggerPaths,
                    ]),
                ]),
            );
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

async function hasSyntaxError(grammar: GrammarName, bytes: Buffer): Promise<boolean> {
    const tree = await parseSource(grammar, bytes.toString('utf8'));
    try {
        return tree.rootNode.hasError;
    } finally {
        tree.delete();
    }
}

async function listBrokenFiles(changed: string[], before: PathBytes, after: PathBytes): Promise<string[]> {
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

function restoreBrokenFiles(root: string, broken: string[], rounds: FixRounds): void {
    const files = openFiles(root);
    for (const path of broken) {
        const now = files.read(path) as FileContents;
        files.write(path, { ...now, bytes: rounds.before.get(path) as Buffer });
    }
}

/**
Runs fixes in passes and collects their results.

@param session the repository and its tools.
@param planned the checks to fix.
*/
export async function runFixers(session: CheckSession, planned: PlannedCheck[]): Promise<FixReport> {
    const checks = planned.filter((check) => check.check.fix !== undefined);
    const paths = [
        ...new Set(
            checks.flatMap((check) => [...new Set([...check.files.map((file) => file.path), ...check.triggerPaths])]),
        ),
    ].toSorted((a, b) => compareText(a, b));
    const rounds = await runFixerRounds(session, checks, paths);
    const { before, after, results } = rounds;
    const changed = listChangedPaths(before, after);
    const broken = await listBrokenFiles(changed, before, after);
    restoreBrokenFiles(session.root, broken, rounds);
    return { results, changed: changed.filter((path) => !broken.includes(path)), broken };
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
