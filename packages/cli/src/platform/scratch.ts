import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync, mkdtempSync, realpathSync } from 'node:fs';
import type { ScratchFolder } from '#cli/types/platform/scratch.ts';

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
