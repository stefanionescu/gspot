// Selects positional repository paths and refuses unknown check IDs.
import { resolve, relative } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import type { Session } from '#cli/types/planning.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import { toPosix, isInside } from '#cli/platform/paths.ts';
import type { CheckOptions } from '#cli/types/commands/check.ts';

// The repository files a selector names: the file itself, or everything under a folder.
function matchingFiles(session: Session, options: CheckOptions, path: string, candidates: string[]): string[] {
    const selector = toPosix(relative(session.root, resolve(options.cwd, path)));
    if (!isInside(selector)) throw new GspotError('selection', [`Path ${path} is outside this repository.`]);
    const matches = candidates.filter((file) => isInScope(file, selector));
    if (matches.length === 0) throw new GspotError('selection', [`Path ${path} matches no repository files.`]);
    return matches;
}

/**
 * Selects tracked and changed repository files through positional paths.
 * @param session the open session
 * @param options the parsed flags
 * @param changed the staged or changed paths, which can name deleted files
 * @returns the selected paths, or none when no path was given
 */
export function selectedPaths(session: Session, options: CheckOptions, changed: string[]): string[] {
    if (options.paths.length === 0) return [];
    const candidates = [...new Set([...session.repository.files.map((file) => file.path), ...changed])];
    const selected = new Set(options.paths.flatMap((path) => matchingFiles(session, options, path, candidates)));
    return [...selected];
}

/**
 * Refuses an --only check no selected configuration runs here.
 * @param session the open session
 * @param only the checks named on the command line
 */
export function refuseUnknownChecks(session: Session, only: string[] | undefined): void {
    const known = new Set([
        ...session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.name)),
        ),
        ...Object.values(session.policyFiles.policy.check).map((check) => check.name),
    ]);
    const unknown = only?.find((check) => !known.has(check));
    if (unknown !== undefined)
        throw new GspotError('selection', [
            `No selected configuration runs a check called \`${unknown}\` here. Run gspot explain ${unknown} to see which configuration ships it.`,
        ]);
}
