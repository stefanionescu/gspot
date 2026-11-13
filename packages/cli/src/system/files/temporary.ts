import { lstatSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    MILLISECONDS_PER_DAY,
    TEMPORARY_FILE_PREFIX,
    TEMPORARY_REMOVAL_OPTIONS,
    TEMPORARY_STALE_DAYS,
} from '#cli/config/system.ts';
import { isProcessRunning } from '#cli/system/processes/stop.ts';
import { printWarning } from '#cli/system/terminal.ts';
import type { Files, TemporaryFolder } from '#cli/types/system.ts';

function isStaleTemporaryPath(path: string, pid: string | undefined): boolean {
    if (pid !== undefined) return !isProcessRunning(Number(pid));
    const stat = lstatSync(path, { throwIfNoEntry: false });
    return stat !== undefined && Date.now() - stat.mtimeMs > TEMPORARY_STALE_DAYS * MILLISECONDS_PER_DAY;
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
            rmSync(path, TEMPORARY_REMOVAL_OPTIONS);
        },
    };
}
