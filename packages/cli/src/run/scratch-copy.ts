import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Session } from '#types/run.ts';
import { cpSync, existsSync, mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';

const SCRATCH_EXTRAS = ['gspot.toml', 'package.json', 'tsconfig.json', 'pyproject.toml'];
const SCRATCH_DIRECTORIES = ['node_modules', '.venv'];

/**
 * Copies selected source and configuration files for commands run outside the working tree.
 * @param session the repository session
 * @param paths the source paths relative to the repository root
 * @returns the temporary directory, which the caller must remove
 */
export function scratchCopy(session: Session, paths: string[]): string {
    const scratch = mkdtempSync(join(tmpdir(), 'gspot-fix-'));
    const owned = session.repository.files.filter((file) => file.path.startsWith('.gspot/')).map((file) => file.path);
    for (const path of [...paths, ...owned, ...SCRATCH_EXTRAS]) {
        const source = join(session.root, path);
        if (!existsSync(source)) continue;
        mkdirSync(dirname(join(scratch, path)), { recursive: true });
        cpSync(source, join(scratch, path));
    }
    for (const dir of SCRATCH_DIRECTORIES)
        if (existsSync(join(session.root, dir))) symlinkSync(join(session.root, dir), join(scratch, dir), 'dir');
    return scratch;
}
