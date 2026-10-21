import ignore from 'ignore';
import { posix } from 'node:path';
import { joinScope } from '#cli/repository/scopes.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/tracked.ts';
import type { PathIgnore } from '#cli/types/repository/inventory.ts';
import { GITIGNORE_COMMENT, GITIGNORE_NEGATION } from '#cli/config/repository/gitignore.ts';

function readPatternLines(reads: ReadCache, file: string): string[] {
    return readCachedText(reads, file)
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith(GITIGNORE_COMMENT));
}

// A pattern with a slash before its end starts at its .gitignore folder; any other pattern matches at any depth.
function anchorLine(folder: string, line: string): string {
    if (folder === '') return line;
    const body = line.replace(/^\//u, '');
    const isAnchored = line.startsWith('/') || line.slice(0, -1).includes('/');
    return isAnchored ? `/${folder}/${body}` : `/${folder}/**/${body}`;
}

/**
 * List the patterns of the tracked .gitignore files as lines of one root ignore file, without negations.
 *
 * @param reads the run cache.
 * @param trackedPaths the tracked files of the repository.
 * @returns the patterns, each anchored at the folder of its .gitignore.
 */
export function listGitignorePatterns(reads: ReadCache, trackedPaths: string[]): string[] {
    return trackedPaths
        .filter((path) => posix.basename(path) === GITIGNORE_FILE)
        .flatMap((file) => {
            const folder = extractParentFolder(file);
            return readPatternLines(reads, file)
                .filter((line) => !line.startsWith(GITIGNORE_NEGATION))
                .map((line) => anchorLine(folder, line));
        });
}

/**
 * Test a path against ignore files in order, keeping later negations.
 *
 * @param candidate the repository-relative file or folder path.
 * @param ignores the patterns with the folder that contains each ignore file.
 * @returns whether the final matching pattern ignores the path.
 */
export function isIgnored(candidate: string, ignores: PathIgnore[]): boolean {
    let ignored = false;
    for (const { base, matcher } of ignores) {
        if (!candidate.startsWith(base) || candidate === base) continue;
        const result = matcher.test(candidate.slice(base.length));
        if (result.ignored) ignored = true;
        else if (result.unignored) ignored = false;
    }
    return ignored;
}

/**
 * Build a test for paths that a tracked .gitignore ignores, or that sit inside an ignored folder.
 *
 * @param reads the run cache.
 * @param trackedPaths the tracked files of the repository.
 * @returns whether Git ignores the repository-relative path.
 */
export function buildGitignoreTest(reads: ReadCache, trackedPaths: string[]): (path: string) => boolean {
    const ignores: PathIgnore[] = trackedPaths
        .filter((path) => posix.basename(path) === GITIGNORE_FILE)
        .map((file) => {
            const folder = extractParentFolder(file);
            return {
                base: joinScope(folder, ''),
                matcher: ignore().add(readPatternLines(reads, file).join('\n')),
            };
        });
    return (path) => {
        const segments = path.split('/');
        const folders = segments.slice(0, -1).map((_, index) => `${segments.slice(0, index + 1).join('/')}/`);
        return [...folders, path, `${path}/`].some((candidate) => isIgnored(candidate, ignores));
    };
}
