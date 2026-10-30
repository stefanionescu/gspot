import { tmpdir } from 'node:os';
import { join } from 'node:path';
import picomatch from 'picomatch';
import { globSync } from 'tinyglobby';
import { GspotError } from '#cli/system/errors.ts';
import type { TemporaryFolder } from '#cli/types/system/files.ts';
import { PARENT_SEGMENT } from '#cli/config/system/files/folders.ts';
import { rmSync, lstatSync, mkdtempSync, realpathSync } from 'node:fs';
import { DRIVE_LETTER, GLOB_EXCLUDE } from '#cli/config/files/path-patterns.ts';

function hasSymlinkPrefix(folder: string, pattern: string): boolean {
    const { base } = picomatch.scan(pattern);
    const segments = base.split('/').filter((segment) => segment !== '' && segment !== '.');
    return segments.some(
        (_, index) =>
            lstatSync(join(folder, ...segments.slice(0, index + 1)), { throwIfNoEntry: false })?.isSymbolicLink() ===
            true,
    );
}

function assertInsideFolder(pattern: string): void {
    const bare = pattern.startsWith(GLOB_EXCLUDE) ? pattern.slice(1) : pattern;
    const climbs = bare.startsWith('/') || DRIVE_LETTER.test(bare) || PARENT_SEGMENT.test(bare);
    if (climbs) throw new GspotError('filesystem', `A path pattern cannot leave its folder: ${pattern}`);
}

/**
Makes an empty folder under the system temporary folder that removes itself, with everything in it, when disposed.
Use the real system path, which on Windows expands short folder names, as the paths tools report do.
*/
export function createTemporaryFolder(): TemporaryFolder {
    const folder = mkdtempSync(join(tmpdir(), 'gspot-'));
    const path = realpathSync.native(folder);
    return {
        path,
        [Symbol.dispose]: () => {
            rmSync(path, { recursive: true, force: true });
        },
    };
}

/**
Find the files under the fixed folder of each pattern. Include dot files, and do not open folder links.

@param folder the folder to scan.
@param patterns the globs; a leading ! excludes matches.
@returns matching paths relative to the folder, each once in scan order.
*/
export function listMatchingPaths(folder: string, patterns: string[]): string[] {
    for (const pattern of patterns) assertInsideFolder(pattern);
    const positive = patterns.filter(
        (pattern) => !pattern.startsWith(GLOB_EXCLUDE) && !hasSymlinkPrefix(folder, pattern),
    );
    const excluded = patterns.filter((pattern) => pattern.startsWith(GLOB_EXCLUDE)).map((pattern) => pattern.slice(1));
    return globSync(positive, {
        cwd: folder,
        dot: true,
        ignore: excluded,
        followSymbolicLinks: false,
        expandDirectories: false,
    });
}
