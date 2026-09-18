// The executable bit through git, which is the bit Windows lacks.
import { chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { git } from '#cli/platform/spawn.ts';

/** Marks a tracked or to-be-tracked file executable in git and on disk where the platform allows. */
export function markExecutable(root: string, path: string): void {
    const full = join(root, path);
    if (!existsSync(full)) return;
    if (process.platform !== 'win32') chmodSync(full, 0o755);
    git(root, ['update-index', '--add', '--chmod=+x', '--', path]);
}
