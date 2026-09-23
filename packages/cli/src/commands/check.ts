import type { Stage } from '#cli/presets/types.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { progress } from '#cli/output/progress.ts';
import type { StageFilter, CheckOptions } from '#cli/run/types.ts';
// gspot check
import { Command, Option, InvalidArgumentError } from 'commander';
import { directoryOf, listFlag, textEntry, textFlag } from '#cli/commands/flags.ts';
class CheckCommand extends Command {
    override parseOptions(argv: string[]): {
        operands: string[];
        unknown: string[];
    } {
        const end = argv.indexOf('--');
        return super.parseOptions(
            argv.map((argument, index) =>
                argument === '--changed' && (end === -1 || index < end) ? '--changed=' : argument,
            ),
        );
    }
}
const PUBLIC_STAGES: Stage[] = ['commit', 'push', 'manual'];
function stageArgument(value: string): Stage {
    if (value === 'message') return value;
    const stage = PUBLIC_STAGES.find((entry) => entry === value);
    if (stage === undefined) throw new InvalidArgumentError(`Choose ${PUBLIC_STAGES.join(', ')}.`);
    return stage;
}
function optionsFrom(paths: string[], flags: Record<string, unknown>, global: Record<string, unknown>): CheckOptions {
    const stage = textFlag(flags, 'stage') as StageFilter | undefined;
    const only = listFlag(flags, 'only');
    return {
        cwd: directoryOf(global),
        staged: flags['staged'] === true,
        fix: flags['fix'] === true,
        isDryRun: flags['dryRun'] === true,
        skips: listFlag(flags, 'skip') ?? [],
        quiet: global['quiet'] === true,
        verbose: global['verbose'] === true,
        noCache: flags['cache'] === false,
        paths,
        ...(only === undefined ? {} : { only }),
        ...(typeof flags['changed'] === 'string' ? { changed: flags['changed'] } : {}),
        ...(stage === undefined ? {} : { stage }),
        ...textEntry(flags, 'messageFile', 'messageFile'),
    };
}
/**
 * Registers check.
 * @param program the commander program
 */
export function registerCheck(program: Command): void {
    const command = new CheckCommand('check').copyInheritedSettings(program);
    program.addCommand(command);
    command
        .argument('[paths...]')
        .description('Run checks over the selected files and folders and print findings')
        .addHelpText(
            'after',
            '\nEffects:\nRuns the selected checks and writes managed reports and cache observations. --fix runs configured corrections and can change selected source files. --fix --dry-run previews corrections in a disposable copy. --staged checks index content; --changed checks working-tree content for paths changed from the comparison reference. A plain check uses the working tree.\n\nExit codes:\n0: executed checks passed; review skipped checks separately. 1: findings or failed corrections remain. 2: the run could not complete, including missing tools, invalid reports, or invalid input.\n\nExample:\ngspot check --staged',
        )
        .option('--only <checks...>', 'Run the named checks')
        .addOption(new Option('--push', 'Read Git pre-push object updates from stdin').hideHelp())
        .option('--staged', 'The commit stage over staged files, as the pre-commit hook runs it')
        .option(
            '--changed [ref]',
            'Changed paths from the upstream or default branch; use --changed=<ref> to choose a ref',
        )
        .option('--fix', 'Run every fixer in order, then the checks again')
        .option('--dry-run', 'With --fix, print the diff of every fix and write nothing')
        .addOption(new Option('--stage <stage>', 'One stage').choices(PUBLIC_STAGES).argParser(stageArgument))
        .option('--skip <checks...>', 'Skip the named checks for this run')
        .addOption(new Option('--message-file <path>', 'The commit message file, for the message stage').hideHelp())
        .option('--no-cache', 'Run every check even when its inputs are unchanged')
        .action(async (paths: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            const options = optionsFrom(paths, flags, global);
            if (global['json'] !== true) options.onResult = progress(process.stdout, options.quiet);
            const controller = new AbortController();
            const cancel = (): void => controller.abort();
            process.on('SIGINT', cancel);
            process.on('SIGTERM', cancel);
            try {
                await printCommand(async () => {
                    try {
                        if (flags['push'] === true) {
                            if (paths.length !== 0 && paths.length !== 2)
                                throw new InvalidArgumentError(
                                    'Pre-push expects the remote name and URL supplied by Git.',
                                );
                            const reader = Bun.stdin.stream().getReader();
                            const stopReading = (): void => {
                                void reader.cancel();
                            };
                            controller.signal.addEventListener('abort', stopReading, { once: true });
                            const decoder = new TextDecoder('utf-8', { fatal: true });
                            let input = '';
                            try {
                                controller.signal.throwIfAborted();
                                while (true) {
                                    const chunk = await reader.read();
                                    controller.signal.throwIfAborted();
                                    if (chunk.done) break;
                                    input += decoder.decode(chunk.value, { stream: true });
                                }
                                input += decoder.decode();
                            } finally {
                                controller.signal.removeEventListener('abort', stopReading);
                                reader.releaseLock();
                            }
                            options.paths = [];
                            options.push = { input, ...(paths[0] === undefined ? {} : { remote: paths[0] }) };
                        }
                        return await checkCommand(options, controller.signal);
                    } catch (error) {
                        if (!controller.signal.aborted) throw error;
                        return {
                            text: 'Check canceled before all selected content was checked.\n',
                            json: { error: 'canceled', exitCode: 2 },
                            exitCode: 2,
                        };
                    }
                }, global);
            } finally {
                process.removeListener('SIGINT', cancel);
                process.removeListener('SIGTERM', cancel);
            }
        });
}
import { reproduceLine } from '#cli/run/reproduce.ts';
import type { PushReport } from '#cli/output/report-types.ts';
import { withRevisionSnapshot } from '#cli/repository/snapshot.ts';
import { writeReport } from '#cli/output/report.ts';
import { readFileSync } from 'node:fs';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { runText } from '#cli/output/reporter.ts';
import { hookStatus } from '#cli/lifecycle/hooks.ts';
import { note, warn } from '#cli/output/messages.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { findRoot, isGitRepository } from '#cli/repository/tracked.ts';
// check: open the session, honor the pin, run, render, decide the exit code.
import type { ChangedSet, StagedSet } from '#cli/repository/types.ts';
import { SelectionError } from '#cli/presets/select.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { changedFiles, stagedFiles, pushedRevisions } from '#cli/repository/staged.ts';
import { ENV_FILE_PATTERNS, ENV_TEMPLATE_NAMES } from '#cli/repository/env-files-definitions.ts';
import type { CheckCommandResult, CommandResult, FixReport, RunOptions, Session } from '#cli/run/types.ts';
const CHANGED_SHOWN = 8;
function stagedEnvironmentFiles(staged: string[]): string[] {
    const isEnvironmentFile = pathMatcher(ENV_FILE_PATTERNS.map((pattern) => `**/${pattern}`));
    return staged.filter(
        (path) => isEnvironmentFile(path) && !ENV_TEMPLATE_NAMES.includes(path.slice(path.lastIndexOf('/') + 1)),
    );
}
function isReadable(path: string): boolean {
    try {
        readFileSync(path, 'utf8');
        return true;
    } catch {
        return false;
    }
}
function runOptions(
    options: CheckOptions,
    stage: StageFilter,
    staged: string[] | undefined,
    changed: ChangedSet | undefined,
): RunOptions {
    return {
        stage,
        skips: options.skips,
        fix: options.fix,
        isDryRun: options.isDryRun,
        noCache: options.noCache,
        ...(options.onResult === undefined ? {} : { onResult: options.onResult }),
        ...(staged === undefined ? {} : { staged }),
        ...(changed === undefined
            ? {}
            : {
                  changed: changed.paths,
                  comparison: { content: 'working-tree' as const, reference: changed.reference },
              }),
        ...(options.only === undefined ? {} : { only: options.only }),
        ...(options.paths.length === 0 ? {} : { paths: options.paths }),
        ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }),
    };
}
function fixSummary(fixes: FixReport, isDryRun: boolean, text: string): string {
    const failures = fixes.results.filter((result) => result.status === 'failed');
    for (const result of failures) warn(`a fixer failed: ${result.check}: ${result.note}`);
    const count = fixes.changed.length;
    if (isDryRun) {
        const verdict = count === 0 ? 'no fixer changes anything' : `${String(count)} file(s) would change`;
        return `${fixes.diffs.join('\n')}\n${verdict}\n\n${text}`;
    }
    if (count === 0) note('no fixer changed anything');
    else {
        const shown = fixes.changed.slice(0, CHANGED_SHOWN).join(' ');
        const more = count > CHANGED_SHOWN ? ' ...' : '';
        warn(
            `fixers changed ${String(count)} file(s); the changes are in the working tree and are not staged: ${shown}${more}`,
        );
    }
    return text;
}
function refusalFor(
    options: CheckOptions,
    stage: StageFilter,
    staged: string[] | undefined,
): CommandResult | undefined {
    const environmentStaged = staged === undefined ? [] : stagedEnvironmentFiles(staged);
    if (environmentStaged.length > 0)
        return {
            text: `An environment file is staged: ${environmentStaged.join(', ')}. Unstage it (git restore --staged <file>); only templates like .env.example belong in git.\n`,
            json: { failed: ['integrity/env-files'], files: environmentStaged },
            exitCode: 1,
        };
    if (stage === 'message' && options.messageFile !== undefined && !isReadable(options.messageFile))
        return {
            text: `The commit message file ${options.messageFile} cannot be read.\n`,
            json: { error: 'message-file' },
            exitCode: 2,
        };
    return undefined;
}
function selectedPaths(session: Session, options: CheckOptions, changed: string[]): string[] {
    if (options.paths.length === 0) return [];
    const candidates = [...new Set([...session.repository.files.map((file) => file.path), ...changed])];
    const selected = new Set<string>();
    for (const path of options.paths) {
        const selector = relative(session.root, resolve(options.cwd, path)).split(sep).join('/');
        if (selector === '..' || selector.startsWith('../') || isAbsolute(selector))
            throw new SelectionError([`Path ${path} is outside this repository.`]);
        const matches = candidates.filter(
            (file) => selector === '' || file === selector || file.startsWith(`${selector}/`),
        );
        if (matches.length === 0) throw new SelectionError([`Path ${path} matches no repository files.`]);
        for (const match of matches) selected.add(match);
    }
    return [...selected];
}
function unknownSelection(session: Session, only: string[] | undefined): CommandResult | undefined {
    const known = new Set([
        ...session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.name)),
        ),
        ...session.policyFiles.policy.checks.map((check) => check.name),
    ]);
    const unknown = only?.find((check) => !known.has(check));
    return unknown === undefined
        ? undefined
        : {
              text: `No selected preset runs a check called \`${unknown}\` here. Run gspot explain ${unknown} to see which preset ships it.\n`,
              json: { error: 'unknown-check' },
              exitCode: 2,
          };
}
async function revisionSelection(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
): Promise<ChangedSet | undefined> {
    if ((options.staged || options.changed !== undefined) && !session.repository.hasGit)
        throw new SelectionError(['Revision selection requires a Git repository.']);
    return options.changed === undefined ? undefined : changedFiles(session.root, options.changed, signal);
}
function resultFor(
    options: CheckOptions,
    outcome: Awaited<ReturnType<typeof executeRun>>,
    unstaged: number,
    reportRoot?: string,
): CheckCommandResult {
    outcome.report.unstaged = unstaged;
    if (reportRoot !== undefined && !options.isDryRun && options.stage !== 'message')
        writeReport(reportRoot, outcome.report);
    const rendered = runText(outcome.report, { quiet: options.quiet, verbose: options.verbose });
    const text = outcome.fixes ? fixSummary(outcome.fixes, options.isDryRun, rendered) : rendered;
    return { text, json: outcome.report, report: outcome.report, exitCode: outcome.report.exitCode };
}
/**
 * Runs check and returns what to print.
 * @param options the parsed flags
 * @returns the text, the run report and the exit code
 */
async function checkContent(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
    revision?: {
        commits?: string[];
        historyComplete?: boolean;
        content: 'index' | 'commit';
        reference: string;
        reportRoot?: string;
        staged?: StagedSet;
        changed?: string[];
    },
): Promise<CheckCommandResult> {
    assertPinMatches(root);
    const session = await openSession(root);
    const unknown = unknownSelection(session, options.only);
    if (unknown !== undefined) return unknown;
    if (revision?.content !== 'commit') {
        const hooks = hookStatus({
            root: revision?.reportRoot ?? root,
            policyFiles: session.policyFiles,
            repository: { hasGit: revision?.reportRoot !== undefined || session.repository.hasGit },
        });
        if (!hooks.ready) warn(`Configured hooks are not ready in this clone. ${hooks.text}`);
    }
    let changed =
        revision?.changed === undefined
            ? await revisionSelection(session, options, signal)
            : { reference: revision.reference, paths: revision.changed };
    if (revision?.content === 'commit' && session.policyFiles.policy.hooks?.push === 'all') changed = undefined;
    const set =
        revision?.staged ?? (options.staged ? await stagedFiles(root, signal) : { staged: undefined, unstaged: 0 });
    const stage: StageFilter = options.stage ?? (options.staged ? 'commit' : 'all');
    const refusal = refusalFor(options, stage, set.staged);
    if (refusal) return refusal;
    const paths = selectedPaths(
        session,
        options,
        [set.staged, changed?.paths].flatMap((selection) => selection ?? []),
    );
    const outcome = await executeRun(session, {
        ...runOptions({ ...options, paths }, stage, set.staged, changed),
        ...(revision === undefined ? {} : { comparison: { content: revision.content, reference: revision.reference } }),
        ...(revision?.commits === undefined ? {} : { commits: revision.commits }),
        ...(revision?.historyComplete === undefined ? {} : { historyComplete: revision.historyComplete }),
        cancelSignal: signal,
    });
    if (options.push !== undefined)
        for (const check of outcome.report.checks)
            if (check.reproduce !== undefined) check.reproduce = reproduceLine(check.check, check.scope, options);
    return resultFor(options, outcome, set.unstaged, revision?.reportRoot);
}
/** Check the working tree or an isolated, exact snapshot of the staged index. */
export async function checkCommand(options: CheckOptions, signal: AbortSignal): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    if ((options.staged || options.push !== undefined) && !isGitRepository(root))
        throw new SelectionError(['Revision selection requires a Git repository.']);
    if (options.push !== undefined) {
        if (
            options.staged ||
            options.changed !== undefined ||
            options.fix ||
            options.stage !== undefined ||
            options.messageFile !== undefined
        )
            throw new SelectionError([
                'Pre-push object checks cannot be combined with staged, changed, fix, stage, or message-file options.',
            ]);
        const selected = await pushedRevisions(root, options.push.input, options.push.remote, signal);
        const revisions: PushReport['revisions'] = [];
        const rendered: string[] = [];
        for (const revision of selected.revisions) {
            if (signal.aborted) break;
            let result: CheckCommandResult;
            try {
                result = await withRevisionSnapshot(
                    root,
                    { kind: 'commit', object: revision.object },
                    (snapshot) =>
                        checkContent(snapshot, options, signal, {
                            commits: revision.commits,
                            historyComplete: revision.historyComplete,
                            content: 'commit',
                            reference: revision.object,
                            ...(revision.paths === undefined ? {} : { changed: revision.paths }),
                        }),
                    signal,
                );
            } catch (error) {
                if (!signal.aborted) throw error;
                break;
            }
            if (result.report === undefined) return result;
            revisions.push({
                object: revision.object,
                refs: revision.refs,
                commits: revision.commits,
                historyComplete: revision.historyComplete,
                report: result.report,
            });
            rendered.push(`${revision.refs.join(', ')} at ${revision.object}\n${result.text}`);
        }
        const pendingRefs = selected.revisions.slice(revisions.length).flatMap((revision) => revision.refs);
        const exitCode = Math.max(signal.aborted ? 2 : 0, ...revisions.map((revision) => revision.report.exitCode));
        const report: PushReport = {
            revisions,
            notApplicable: selected.notApplicable,
            exitCode,
            ...(signal.aborted ? { canceled: { pendingRefs } } : {}),
        };
        if (signal.aborted)
            rendered.push(
                `Push checks canceled. References not checked: ${pendingRefs.join(', ') || 'none; see canceled checks above'}.\n`,
            );
        if (!options.isDryRun) writeReport(root, report);
        return {
            text: [
                ...rendered,
                ...selected.notApplicable.map((entry) => `${entry.ref}: ${entry.reason}; no source check applies.\n`),
            ].join(''),
            json: report,
            exitCode,
        };
    }
    if (!options.staged) return checkContent(root, options, signal);
    if (options.fix)
        throw new SelectionError([
            'Staged checks do not run fixers. Run gspot check --fix and stage the reviewed changes.',
        ]);
    if (options.changed !== undefined) throw new SelectionError(['Choose --staged or --changed, not both.']);
    const set = await stagedFiles(root, signal);
    const refusal = refusalFor(options, options.stage ?? 'commit', set.staged);
    if (refusal !== undefined) return refusal;
    return withRevisionSnapshot(
        root,
        { kind: 'index' },
        async (snapshot, tree) => {
            const paths = options.paths.map((path) => relative(root, resolve(options.cwd, path)));
            return checkContent(snapshot, { ...options, cwd: snapshot, paths }, signal, {
                content: 'index',
                reference: tree,
                staged: set,
                reportRoot: root,
            });
        },
        signal,
    );
}
