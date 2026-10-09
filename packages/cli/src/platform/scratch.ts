import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Dirent } from 'node:fs';
import type { ScratchFolder } from '#cli/types/platform/scratch.ts';
import { rmSync, mkdtempSync, readdirSync, realpathSync } from 'node:fs';

/**
 * Makes an empty folder under the system temporary folder that removes itself, with everything in it, when disposed.
 * Its path is the native real path, which on Windows expands short folder names, as the paths tools report do.
 * @param prefix the start of the folder name
 * @returns the folder, which the caller disposes, as `using` does
 */
export function scratchFolder(prefix: string): ScratchFolder {
    const path = realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
    return {
        path,
        [Symbol.dispose]: () => {
            rmSync(path, { recursive: true, force: true });
        },
    };
}

/**
 * Visit native entries under a scratch folder without following directory links.
 * @param folder the scratch directory
 * @returns every entry that is not a directory
 */
export function* scratchEntries(folder: string): Generator<Dirent> {
    const pending = [folder];
    for (const directory of pending)
        for (const entry of readdirSync(directory, { withFileTypes: true }))
            if (entry.isDirectory()) pending.push(join(directory, entry.name));
            else yield entry;
}
