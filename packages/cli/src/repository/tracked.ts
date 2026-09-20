// The file set: what git tracks or is about to track, or a gitignore-honoring walk without git.
import { globby } from 'globby';
import { dirname, join, resolve } from 'node:path';
import type { RawEntry } from '#types/repository.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';

const EXECUTABLE_BITS = 0o111;
const HEAD_BYTES = 2048;
const NOT_REPOSITORY_CODE = 128;

function symlinkEntry(full: string, path: string): RawEntry | undefined {
    try {
        const target = statSync(full);
        return target.isDirectory() ? undefined : { path, size: target.size, executable: false, symlink: true };
    } catch {
        return { path, size: 0, executable: false, symlink: true };
    }
}

function entryFor(root: string, path: string): RawEntry | undefined {
    const full = join(root, path);
    let stat;
    try {
        stat = lstatSync(full);
    } catch {
        return undefined;
    }
    if (stat.isSymbolicLink()) return symlinkEntry(full, path);
    if (stat.isDirectory()) return undefined;
    const isExecutable = process.platform !== 'win32' && (stat.mode & EXECUTABLE_BITS) !== 0;
    return { path, size: stat.size, executable: isExecutable, symlink: false };
}

function hasGitEntry(directory: string): boolean {
    try {
        lstatSync(join(directory, '.git'));
        return true;
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    const parent = dirname(directory);
    return parent !== directory && hasGitEntry(parent);
}

function isOutsideGit(root: string): boolean {
    const probe = runBlocking(['git', 'rev-parse', '--is-inside-work-tree'], {
        cwd: root,
        env: { LC_ALL: 'C' },
    });
    return (
        probe.code === NOT_REPOSITORY_CODE &&
        probe.stderr.startsWith('fatal: not a git repository (or any ') &&
        !hasGitEntry(resolve(root))
    );
}

async function listedPaths(root: string): Promise<string[]> {
    const listed = runBlocking(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root });
    if (listed.code === 0) return listed.stdout.split('\0').filter((path) => path !== '');
    if (!isOutsideGit(root))
        throw new Error(`Git ls-files failed in ${root} (exit ${String(listed.code)}): ${listed.stderr.trim()}`);
    return globby(['**/*'], {
        cwd: root,
        gitignore: true,
        dot: true,
        onlyFiles: true,
        followSymbolicLinks: false,
        ignore: ['**/.git/**'],
    });
}

/**
 * True when the root is inside a git work tree.
 * @param root the directory
 * @returns whether a .git entry is there
 */
export function isGitRepository(root: string): boolean {
    return existsSync(join(root, '.git'));
}

/**
 * The repository root for a directory: git's answer, or the nearest directory holding gspot.toml.
 * @param start the directory to start from
 * @returns the root
 */
export function findRoot(start: string): string {
    const top = runBlocking(['git', 'rev-parse', '--show-toplevel'], { cwd: start });
    if (top.code === 0 && top.stdout.trim() !== '') return top.stdout.trim();
    if (!isOutsideGit(start))
        throw new Error(`Git root discovery failed in ${start} (exit ${String(top.code)}): ${top.stderr.trim()}`);
    let dir = start;
    for (;;) {
        if (existsSync(join(dir, 'gspot.toml'))) return dir;
        const parent = join(dir, '..');
        if (parent === dir) return start;
        dir = parent;
    }
}

/**
 * Tracked and about-to-be-tracked files, root-relative posix, sorted. Falls back to a gitignore walk without git.
 * @param root the repository root
 * @returns the entries with size, executable bit and symlink flag
 */
export async function trackedEntries(root: string): Promise<RawEntry[]> {
    const paths = await listedPaths(root);
    return [...new Set(paths)]
        .filter((path) => !path.startsWith('.git/') && path !== '.git')
        .toSorted((a, b) => a.localeCompare(b))
        .map((path) => entryFor(root, path))
        .filter((entry) => entry !== undefined);
}

/**
 * The first bytes of a file as text, for shebang and banner checks.
 * @param root the repository root
 * @param path the file, relative to the root
 * @param bytes how many bytes to read
 * @returns the text, '' when the file cannot be read
 */
export function head(root: string, path: string, bytes = HEAD_BYTES): string {
    try {
        return readFileSync(join(root, path)).subarray(0, bytes).toString('utf8');
    } catch {
        return '';
    }
}
