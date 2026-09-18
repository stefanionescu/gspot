// The file set: what git tracks or would track, or a gitignore-honoring walk without git.
import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { globby } from 'globby';

import { git } from '#cli/platform/spawn.ts';

export type RawEntry = { path: string; size: number; executable: boolean; symlink: boolean };

function entryFor(root: string, path: string): RawEntry | undefined {
    const full = join(root, path);
    let stat;
    try {
        stat = lstatSync(full);
    } catch {
        return undefined;
    }
    if (stat.isSymbolicLink()) {
        let target;
        try {
            target = statSync(full);
        } catch {
            return { path, size: 0, executable: false, symlink: true };
        }
        if (target.isDirectory()) return undefined;
        return { path, size: target.size, executable: false, symlink: true };
    }
    if (stat.isDirectory()) return undefined;
    return {
        path,
        size: stat.size,
        executable: process.platform !== 'win32' && (stat.mode & 0o111) !== 0,
        symlink: false,
    };
}

/** True when the root is inside a git work tree. */
export function isGitRepository(root: string): boolean {
    return existsSync(join(root, '.git'));
}

/** The repository root for a directory: git's answer, or the nearest directory holding gspot.toml. */
export function findRoot(start: string): string {
    const top = git(start, ['rev-parse', '--show-toplevel']);
    if (top !== undefined && top.trim() !== '') return top.trim();
    let dir = start;
    for (;;) {
        if (existsSync(join(dir, 'gspot.toml'))) return dir;
        const parent = join(dir, '..');
        if (parent === dir) return start;
        dir = parent;
    }
}

/** Tracked and would-be-tracked files, root-relative posix, sorted. Falls back to a gitignore walk without git. */
export async function trackedEntries(root: string): Promise<RawEntry[]> {
    const listed = git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
    let paths: string[];
    if (listed !== undefined) {
        paths = listed.split('\0').filter(Boolean);
    } else {
        paths = await globby(['**/*'], {
            cwd: root,
            gitignore: true,
            dot: true,
            onlyFiles: true,
            followSymbolicLinks: false,
            ignore: ['**/.git/**'],
        });
    }
    const unique = [...new Set(paths)].filter((path) => !path.startsWith('.git/') && path !== '.git').sort();
    const entries: RawEntry[] = [];
    for (const path of unique) {
        const entry = entryFor(root, path);
        if (entry) entries.push(entry);
    }
    return entries;
}

/** Reads the executable bit git records for a path, which is the one that matters on Windows. */
export function gitExecutable(root: string, path: string): boolean {
    const out = git(root, ['ls-files', '-s', '--', path]);
    return out !== undefined && out.startsWith('100755');
}

/** The first bytes of a file as text, for shebang and banner checks. */
export function head(root: string, path: string, bytes = 2048): string {
    try {
        const buffer = readFileSync(join(root, path));
        return buffer.subarray(0, bytes).toString('utf8');
    } catch {
        return '';
    }
}
