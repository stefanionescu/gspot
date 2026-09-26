// What a check run refuses or narrows before it starts: staged secrets, unreadable messages, unknown checks, paths.
import { readFileSync } from 'node:fs';
import { pathMatcher } from '#cli/repository/paths.ts';
import { SelectionError } from '#cli/configurations/select.ts';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { CheckOptions } from '#cli/types/commands/check.ts';
import type { ChangedSet } from '#cli/types/repository/revisions.ts';
import type { CommandResult } from '#cli/types/commands/commands.ts';
import { INVALID_INPUT_EXIT } from '#cli/constants/commands/check.ts';
import { changedFiles } from '#cli/repository/revisions/selection.ts';
import type { Session, StageFilter } from '#cli/types/execution/execution.ts';
import { ENV_FILE_PATTERNS, ENV_TEMPLATE_NAMES } from '#cli/constants/repository/repository.ts';

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

// The repository files a selector names: the file itself, or everything under a folder.
function matchingFiles(session: Session, options: CheckOptions, path: string, candidates: string[]): string[] {
    const selector = relative(session.root, resolve(options.cwd, path)).split(sep).join('/');
    if (selector === '..' || selector.startsWith('../') || isAbsolute(selector))
        throw new SelectionError([`Path ${path} is outside this repository.`]);
    const matches = candidates.filter(
        (file) => selector === '' || file === selector || file.startsWith(`${selector}/`),
    );
    if (matches.length === 0) throw new SelectionError([`Path ${path} matches no repository files.`]);
    return matches;
}

/**
 * The refusal a run ends with before starting: a staged environment file, or an unreadable commit message.
 * @param options the parsed flags
 * @param stage the stage the run covers
 * @param staged the staged files, when the run reads the index
 * @returns the refusal, or undefined when the run may start
 */
export function refusalFor(
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
            exitCode: INVALID_INPUT_EXIT,
        };
    return undefined;
}

/**
 * The repository files the positional paths select, among the tracked files and the changed ones.
 * @param session the open session
 * @param options the parsed flags
 * @param changed the staged or changed paths, which may name files no longer in the tree
 * @returns the selected paths, or none when no path was given
 */
export function selectedPaths(session: Session, options: CheckOptions, changed: string[]): string[] {
    if (options.paths.length === 0) return [];
    const candidates = [...new Set([...session.repository.files.map((file) => file.path), ...changed])];
    const selected = new Set(options.paths.flatMap((path) => matchingFiles(session, options, path, candidates)));
    return [...selected];
}

/**
 * The refusal for an --only check no selected configuration runs here.
 * @param session the open session
 * @param only the checks named on the command line
 * @returns the refusal, or undefined when every named check is known
 */
export function unknownSelection(session: Session, only: string[] | undefined): CommandResult | undefined {
    const known = new Set([
        ...session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.name)),
        ),
        ...session.policyFiles.policy.checks.map((check) => check.name),
    ]);
    const unknown = only?.find((check) => !known.has(check));
    if (unknown === undefined) return undefined;
    return {
        text: `No selected configuration runs a check called \`${unknown}\` here. Run gspot explain ${unknown} to see which configuration ships it.\n`,
        json: { error: 'unknown-check' },
        exitCode: INVALID_INPUT_EXIT,
    };
}

/**
 * The files changed against the --changed ref, when one was given.
 * @param session the open session
 * @param options the parsed flags
 * @param signal cancellation for the Git commands
 * @returns the changed set, or undefined without a ref
 */
export async function revisionSelection(
    session: Session,
    options: CheckOptions,
    signal: AbortSignal,
): Promise<ChangedSet | undefined> {
    if ((options.staged || options.changed !== undefined) && !session.repository.hasGit)
        throw new SelectionError(['Revision selection requires a Git repository.']);
    return options.changed === undefined ? undefined : changedFiles(session.root, options.changed, signal);
}
