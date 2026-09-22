// The file set: what git tracks or is about to track, or a gitignore-honoring walk without git.
import { globby } from 'globby';
import { dirname, join, resolve } from 'node:path';
import type { SpawnResult } from '#cli/platform/types.ts';
import type { RawEntry } from '#cli/repository/types.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { existsSync, lstatSync, statSync, openSync, readSync, closeSync } from 'node:fs';

const EXECUTABLE_BITS = 0o111;
const HEAD_BYTES = 2048;
const NOT_REPOSITORY_CODE = 128;

function symlinkEntry(full: string, path: string): RawEntry | undefined {
    try {
        const target = statSync(full);
        return target.isDirectory() ? undefined : { path, size: target.size, executable: false, symlink: true };
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        return { path, size: 0, executable: false, symlink: true };
    }
}

function entryFor(root: string, path: string): RawEntry | undefined {
    const full = join(root, path);
    let stat;
    try {
        stat = lstatSync(full);
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
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

function isOutsideGit(
    root: string,
    probe: SpawnResult = runBlocking(['git', 'rev-parse', '--is-inside-work-tree'], {
        cwd: root,
        env: { LC_ALL: 'C' },
    }),
): boolean {
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
 * @returns whether Git confirms a work tree
 * @throws when Git cannot establish the repository state
 */
export function isGitRepository(root: string): boolean {
    const probe = runBlocking(['git', 'rev-parse', '--is-inside-work-tree'], {
        cwd: root,
        env: { LC_ALL: 'C' },
    });
    if (probe.code === 0 && probe.stdout.trim() === 'true') return true;
    if (isOutsideGit(root, probe)) return false;
    throw new Error(`Git work-tree discovery failed in ${root} (exit ${String(probe.code)}): ${probe.stderr.trim()}`);
}

/**
 * The nearest configuration root within the Git repository, or the root used for initialization.
 * @param start the directory to start from
 * @returns the root
 */
export function findRoot(start: string): string {
    const directory = resolve(start);
    const top = runBlocking(['git', 'rev-parse', '--show-toplevel'], { cwd: directory });
    const gitRoot = top.code === 0 ? resolve(top.stdout.trim()) : undefined;
    if (gitRoot === undefined && !isOutsideGit(directory))
        throw new Error(`Git root discovery failed in ${directory} (exit ${String(top.code)}): ${top.stderr.trim()}`);
    let current = directory;
    while (!existsSync(join(current, 'gspot.toml'))) {
        if (current === gitRoot) return gitRoot;
        const parent = dirname(current);
        if (parent === current) return directory;
        current = parent;
    }
    return current;
}

/**
 * Paths in the Git index, including tracked deletions. A non-Git directory has none.
 * @param root the repository root
 * @returns the indexed paths
 */
export function indexedPaths(root: string): string[] {
    const listed = runBlocking(['git', 'ls-files', '--cached', '-z'], { cwd: root });
    if (listed.code === 0) return [...new Set(listed.stdout.split('\0').filter((path) => path !== ''))];
    if (isOutsideGit(root)) return [];
    throw new Error(`Git index listing failed in ${root} (exit ${String(listed.code)}): ${listed.stderr.trim()}`);
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
 * Reads a bounded prefix, closing the descriptor even when reading fails.
 * @param root the repository root
 * @param path the root-relative file
 * @param bytes the maximum byte count
 * @returns the bytes read
 */
export function readPrefix(root: string, path: string, bytes: number): Buffer {
    const buffer = Buffer.alloc(bytes);
    const descriptor = openSync(join(root, path), 'r');
    let offset = 0;
    try {
        while (offset < bytes) {
            const count = readSync(descriptor, buffer, { offset, length: bytes - offset, position: offset });
            if (count === 0) break;
            offset += count;
        }
        return buffer.subarray(0, offset);
    } finally {
        closeSync(descriptor);
    }
}

/**
 * The first bytes of required file content as text, for shebang and banner checks.
 * @param root the repository root
 * @param path the file, relative to the root
 * @param bytes how many bytes to read
 * @returns the text
 * @throws when required content cannot be read
 */
export function head(root: string, path: string, bytes = HEAD_BYTES): string {
    return readPrefix(root, path, bytes).toString('utf8');
}
