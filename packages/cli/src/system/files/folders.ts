// Creates scratch folders and lists files without following links.
import { tmpdir } from 'node:os';
import picomatch from 'picomatch';
import { join, relative } from 'node:path';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { ScratchFolder } from '#cli/types/system/files.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { rmSync, lstatSync, mkdtempSync, realpathSync } from 'node:fs';
import { GLOB_EXCLUDE, DRIVE_LETTER, PARENT_SEGMENT, FOLDER_CONTENTS } from '#cli/config/system/paths.ts';

// Refuses a pattern that climbs out of the folder it scans, in plain form, or hidden in a brace alternative.
function assertInsideFolder(pattern: string): void {
    const bare = pattern.startsWith('!') ? pattern.slice(1) : pattern;
    // An absolute path starts with a slash, or on Windows with a drive letter.
    const climbs = bare.startsWith('/') || DRIVE_LETTER.test(bare) || PARENT_SEGMENT.test(bare);
    if (climbs) throw new Error(`A path pattern cannot leave its folder: ${pattern}`);
}

/**
 * Makes an empty folder under the system temporary folder that removes itself, with everything in it, when disposed.
 * Use the real system path, which on Windows expands short folder names, as the paths tools report do.
 * @returns the folder, which the caller disposes, as `using` does.
 */
export function createScratchFolder(): ScratchFolder {
    const path = realpathSync.native(mkdtempSync(join(tmpdir(), 'gspot-')));
    return {
        path,
        [Symbol.dispose]: () => {
            rmSync(path, { recursive: true, force: true });
        },
    };
}

/**
 * Find files under each pattern's fixed folder. Include dot files and leave directory links unopened.
 * @param cwd the folder to scan.
 * @param patterns one glob or several, with ! patterns excluding matches.
 * @returns matching paths relative to cwd, each once in scan order.
 */
export function listMatchingPaths(cwd: string, patterns: string | string[]): string[] {
    const list = [patterns].flat();
    for (const pattern of list) assertInsideFolder(pattern);
    const positive = list.filter((pattern) => !pattern.startsWith(GLOB_EXCLUDE));
    const excluded = list.filter((pattern) => pattern.startsWith(GLOB_EXCLUDE)).map((pattern) => pattern.slice(1));
    const matches = picomatch(positive, { dot: true });
    const isExcluded = picomatch(excluded, { dot: true });
    const isPruned = picomatch(
        excluded
            .filter((pattern) => pattern.endsWith(FOLDER_CONTENTS))
            .map((pattern) => pattern.slice(0, -FOLDER_CONTENTS.length)),
    );
    const found = new Set<string>();
    const addMatchedFile = (absolute: string): void => {
        const file = convertToPosixPath(relative(cwd, absolute));
        if (matches(file) && !isExcluded(file)) found.add(file);
    };
    const roots = positive.values().flatMap((pattern) => {
        const { base, glob } = picomatch.scan(pattern);
        const parts = base.split('/').filter((part) => part !== '' && part !== '.');
        if (
            parts.some(
                (_, index) =>
                    lstatSync(join(cwd, ...parts.slice(0, index + 1)), { throwIfNoEntry: false })?.isSymbolicLink() ===
                    true,
            )
        )
            return [];
        const path = join(cwd, base);
        const stat = lstatSync(path, { throwIfNoEntry: false });
        if (stat === undefined) return [];
        if (!stat.isDirectory()) return glob === '' ? [{ path, isFolder: false }] : [];
        return isPruned(base) ? [] : [{ path, isFolder: true }];
    });
    for (const { path: start, isFolder } of roots) {
        if (!isFolder) {
            addMatchedFile(start);
            continue;
        }
        using files = openFiles(start);
        walkFiles(files, '', (path) => {
            const absolute = join(start, path);
            if (lstatSync(absolute).isDirectory()) return !isPruned(convertToPosixPath(relative(cwd, absolute)));
            addMatchedFile(absolute);
            return false;
        });
    }
    return [...found];
}
