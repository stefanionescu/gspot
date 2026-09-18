// The executable bit through git, which is the bit Windows lacks.
import { join } from 'node:path';
import { git } from '#cli/platform/spawn.ts';
import { chmodSync, existsSync } from 'node:fs';

const EXECUTABLE_MODE = 0o755;

/**
 * Marks a tracked or to-be-tracked file executable in git and on disk where the platform allows.
 * @param root the repository root
 * @param path the file, relative to the root
 */
export function markExecutable(root: string, path: string): void {
    const full = join(root, path);
    if (!existsSync(full)) return;
    if (process.platform !== 'win32') chmodSync(full, EXECUTABLE_MODE);
    git(root, ['update-index', '--add', '--chmod=+x', '--', path]);
}
