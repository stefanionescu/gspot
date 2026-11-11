import { lstatSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import picomatch from 'picomatch';
import { globSync } from 'tinyglobby';

import {
    DRIVE_LETTER,
    GLOB_EXCLUDE,
    PARENT_SEGMENT,
    TEMPORARY_FILE_PREFIX,
    TEMPORARY_REMOVAL_OPTIONS,
    TEMPORARY_STALE_MILLISECONDS,
} from '#cli/config/system.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isProcessRunning } from '#cli/system/processes.ts';
import { printWarning } from '#cli/system/terminal.ts';
import type { Files, TemporaryFolder } from '#cli/types/system.ts';

function isStaleTemporaryPath(path: string, pid: string | undefined): boolean {
    if (pid !== undefined) return !isProcessRunning(Number(pid));
    const stat = lstatSync(path, { throwIfNoEntry: false });
    return stat !== undefined && Date.now() - stat.mtimeMs > TEMPORARY_STALE_MILLISECONDS;
}

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
    if (bare.startsWith('/') || DRIVE_LETTER.test(bare) || PARENT_SEGMENT.test(bare))
        throw new GspotError('filesystem', `A path pattern cannot leave its folder: ${pattern}`);
}

/**
Remove interrupted temporary writes and installs. Keep live owners and recent files without an owner.
*/
export function deleteStaleTemporaryPaths(files: Files, folder: string, pattern: RegExp): void {
    const names = files.list(folder);
    if (names.length === 0) return;
    const parent = files.readCanonicalPath(folder);
    for (const name of names) {
        const match = pattern.exec(name);
        if (match === null) continue;
        const path = join(parent, name);
        const pid = match.groups?.['pid'];
        if (!isStaleTemporaryPath(path, pid)) continue;
        try {
            rmSync(path, TEMPORARY_REMOVAL_OPTIONS);
        } catch (error) {
            printWarning(`Could not remove temporary path ${path}: ${String(error)}`);
        }
    }
}

/**
Makes an empty folder in the system temporary folder that removes itself, with everything in it, when disposed.
Use the real system path, which on Windows expands short folder names, as the paths tools report do.
*/
export function createTemporaryFolder(): TemporaryFolder {
    const folder = mkdtempSync(join(tmpdir(), TEMPORARY_FILE_PREFIX));
    const path = realpathSync.native(folder);
    return {
        path,
        [Symbol.dispose]: () => {
            rmSync(path, { recursive: true, force: true });
        },
    };
}

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
