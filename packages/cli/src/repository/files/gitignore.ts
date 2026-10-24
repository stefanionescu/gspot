import ignore from 'ignore';
import { posix } from 'node:path';
import { joinScope } from '#cli/repository/scopes.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { PathIgnore } from '#cli/types/repository/files.ts';
import { isInside, extractParentFolder } from '#cli/system/paths.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/files/tracked.ts';
import { GITIGNORE_COMMENT } from '#cli/config/repository/files/gitignore.ts';

function readPatternLines(reads: ReadCache, file: string): string[] {
    return readCachedText(reads, file)
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith(GITIGNORE_COMMENT));
}

/**
Test a path against ignore files in order, keeping later negations.

@param path the repository-relative file or folder path.
@param ignores the patterns with the folder that contains each ignore file.
@returns whether the final matching pattern ignores the path.
*/
export function isIgnored(path: string, ignores: PathIgnore[]): boolean {
    let isPathIgnored = false;
    for (const { base, matcher } of ignores) {
        if (path === base || !path.startsWith(base)) continue;
        const result = matcher.test(path.slice(base.length));
        if (result.ignored) isPathIgnored = true;
        else if (result.unignored) isPathIgnored = false;
    }
    return isPathIgnored;
}

/**
Build a test for paths that a tracked .gitignore ignores, or that sit inside an ignored folder.

@param reads the run cache.
@param trackedPaths the tracked files of the repository.
@returns whether Git ignores the repository-relative path.
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
        if (!isInside(path)) return false;
        const segments = path.split('/');
        const folders = segments.slice(0, -1).map((_, index) => `${segments.slice(0, index + 1).join('/')}/`);
        return [...folders, path, `${path}/`].some((checkedPath) => isIgnored(checkedPath, ignores));
    };
}
