// Creates scratch folders and lists files without following links.
import { tmpdir } from 'node:os';
import picomatch from 'picomatch';
import type { Dirent } from 'node:fs';
import { join, relative } from 'node:path';
import { toPosix } from '#cli/system/paths.ts';
import type { ScratchFolder } from '#cli/types/system/files.ts';
import { rmSync, lstatSync, mkdtempSync, readdirSync, realpathSync } from 'node:fs';
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
export function scratchFolder(): ScratchFolder {
    const path = realpathSync.native(mkdtempSync(join(tmpdir(), 'gspot-')));
    return {
        path,
        [Symbol.dispose]: () => {
            rmSync(path, { recursive: true, force: true });
        },
    };
}

/**
 * Visit entries under a temporary folder without following directory links.
 * @param folder the scratch directory.
 * @param skip whether to omit the contents of a directory.
 * @returns every entry other than directories.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- reason: The directory walk keeps skip decisions and pending directories in one loop without adding a one-caller traversal wrapper.
export function* listFolderFiles(folder: string, skip?: (entry: Dirent) => boolean): Generator<Dirent> {
    const pending = [folder];
    for (const directory of pending) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (skip?.(entry) === true) continue;
            if (entry.isDirectory()) {
                pending.push(join(directory, entry.name));
                continue;
            }
            yield entry;
        }
    }
}

/**
 * Find files under each pattern's fixed folder. Include dot files and leave directory links unopened.
 * @param cwd the folder to scan.
 * @param patterns one glob or several, with ! patterns excluding matches.
 * @returns matching paths relative to cwd, each once in scan order.
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- reason: Glob traversal keeps fixed folder roots and exclusions together; splitting it repeats filesystem and match state.
export function globPaths(cwd: string, patterns: string | string[]): string[] {
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
    for (const pattern of positive) {
        const { base, glob } = picomatch.scan(pattern);
        const parts = base.split('/').filter((part) => part !== '' && part !== '.');
        if (
            parts.some(
                (_, index) =>
                    lstatSync(join(cwd, ...parts.slice(0, index + 1)), { throwIfNoEntry: false })?.isSymbolicLink() ===
                    true,
            )
        )
            continue;
        const start = join(cwd, base);
        const stat = lstatSync(start, { throwIfNoEntry: false });
        if (stat === undefined) continue;
        if (glob === '' && !stat.isDirectory()) {
            const file = toPosix(relative(cwd, start));
            if (matches(file) && !isExcluded(file)) found.add(file);
            continue;
        }
        if (!stat.isDirectory() || isPruned(base)) continue;
        for (const entry of listFolderFiles(
            start,
            (entry) => entry.isDirectory() && isPruned(toPosix(relative(cwd, join(entry.parentPath, entry.name)))),
        )) {
            const file = toPosix(relative(cwd, join(entry.parentPath, entry.name)));
            if (matches(file) && !isExcluded(file)) found.add(file);
        }
    }
    return [...found];
}
