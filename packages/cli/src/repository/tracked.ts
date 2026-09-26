// The file set: what git tracks or is about to track, or a gitignore-honoring walk without git.
import ignore, { type Ignore } from 'ignore';
import { dirname, join, resolve } from 'node:path';
import { runBlocking } from '#cli/platform/spawn.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { SpawnResult } from '#cli/types/platform.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { LIFECYCLE_PRIVATE_PATH } from '#cli/constants/platform.ts';
import type { RawEntry, SourceObservations } from '#cli/types/repository/repository.ts';
import { lstatSync, statSync, openSync, readSync, closeSync, readFileSync, readdirSync } from 'node:fs';

import {
    DEPENDENCY_FOLDERS,
    EXECUTABLE_BITS,
    NATURE_HEAD_BYTES,
    NOT_REPOSITORY_CODE,
} from '#cli/constants/repository/repository.ts';

function symlinkEntry(root: string, path: string): RawEntry | undefined {
    const files = openConfinedRoot(root, 'native');
    try {
        const target = statSync(files.source(path));
        return target.isDirectory() ? undefined : { path, size: target.size, executable: false, symlink: true };
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        return { path, size: 0, executable: false, symlink: true };
    } finally {
        files.close();
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
    if (stat.isSymbolicLink()) {
        if (DEPENDENCY_FOLDERS.includes(path.slice(path.lastIndexOf('/') + 1))) return undefined;
        // Inventory installed links without reading their dependency targets outside this root.
        if (
            path
                .split('/')
                .slice(0, -1)
                .some((part) => DEPENDENCY_FOLDERS.includes(part))
        )
            return { path, size: stat.size, executable: false, symlink: true };
        return symlinkEntry(root, path);
    }
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
    inspection: SpawnResult = runBlocking(['git', 'rev-parse', '--is-inside-work-tree'], {
        cwd: root,
        env: { LC_ALL: 'C' },
    }),
): boolean {
    return (
        inspection.code === NOT_REPOSITORY_CODE &&
        inspection.stderr.startsWith('fatal: not a git repository (or any ') &&
        !hasGitEntry(resolve(root))
    );
}

function walkPaths(root: string): string[] {
    const paths: string[] = [];
    const pending: { directory: string; rules: { base: string; matcher: Ignore }[] }[] = [{ directory: '', rules: [] }];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
        const { directory, rules } = next;
        const entries = readdirSync(join(root, directory), { withFileTypes: true });
        const localRules = [...rules];
        if (entries.some((entry) => entry.name === '.gitignore' && entry.isFile())) {
            localRules.push({
                base: directory,
                matcher: ignore().add(readSource(root, `${directory}.gitignore`).toString('utf8')),
            });
        }
        for (const entry of entries) {
            if (entry.name === '.git' || entry.isSymbolicLink()) continue;
            const path = `${directory}${entry.name}`;
            const candidate = entry.isDirectory() ? `${path}/` : path;
            let ignored = false;
            for (const { base, matcher } of localRules) {
                const result = matcher.test(candidate.slice(base.length));
                if (result.ignored) ignored = true;
                else if (result.unignored) ignored = false;
            }
            if (ignored || LIFECYCLE_PRIVATE_PATH.test(path.normalize('NFC'))) continue;
            if (entry.isDirectory()) pending.push({ directory: candidate, rules: localRules });
            else if (entry.isFile()) paths.push(path);
        }
    }
    return paths;
}

function listedPaths(root: string): string[] {
    const listed = runBlocking(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root });
    if (listed.code === 0) return listed.stdout.split('\0').filter((path) => path !== '');
    if (!isOutsideGit(root))
        throw new Error(`Git ls-files failed in ${root} (exit ${String(listed.code)}): ${listed.stderr.trim()}`);
    return walkPaths(root);
}

/**
 * True when the root is inside a git work tree.
 * @param root the directory
 * @returns whether Git confirms a work tree
 * @throws when Git cannot establish the repository state
 */
export function isGitRepository(root: string): boolean {
    const inspection = runBlocking(['git', 'rev-parse', '--is-inside-work-tree'], {
        cwd: root,
        env: { LC_ALL: 'C' },
    });
    if (inspection.code === 0 && inspection.stdout.trim() === 'true') return true;
    if (isOutsideGit(root, inspection)) return false;
    throw new Error(
        `Git work-tree discovery failed in ${root} (exit ${String(inspection.code)}): ${inspection.stderr.trim()}`,
    );
}

/**
 * The nearest configuration root within the Git repository, or the root used for initialization.
 * @param start the directory to start from
 * @param markers files that identify the requested repository root
 * @returns the root
 */
export function findRoot(start: string, markers = ['gspot.toml']): string {
    const directory = resolve(start);
    const top = runBlocking(['git', 'rev-parse', '--show-toplevel'], { cwd: directory });
    const gitRoot = top.code === 0 ? resolve(top.stdout.trim()) : undefined;
    if (gitRoot === undefined && !isOutsideGit(directory))
        throw new Error(`Git root discovery failed in ${directory} (exit ${String(top.code)}): ${top.stderr.trim()}`);
    let current = directory;
    while (!markers.some((marker) => statSync(join(current, marker), { throwIfNoEntry: false }) !== undefined)) {
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
 * List gitlinks without opening submodule directories or reading their configuration.
 * @param root the repository root
 * @returns the submodule paths
 */
export function submodulePaths(root: string): string[] {
    const listed = runBlocking(['git', 'ls-files', '--stage', '-z'], { cwd: root });
    if (listed.code === 0)
        return [
            ...new Set(
                listed.stdout
                    .split('\0')
                    .filter((entry) => entry.startsWith('160000 '))
                    .map((entry) => entry.slice(entry.indexOf('\t') + 1)),
            ),
        ].toSorted((left, right) => left.localeCompare(right));
    if (isOutsideGit(root)) return [];
    throw new Error(`Git submodule listing failed in ${root}: ${listed.stderr.trim()}`);
}

/**
 * Tracked and about-to-be-tracked files, root-relative posix, sorted. Falls back to a gitignore walk without git.
 * @param root the repository root
 * @param exclude the paths to leave out
 * @returns the entries with size, executable bit and symlink flag
 */
export function trackedEntries(root: string, exclude: string[] = []): RawEntry[] {
    const paths = listedPaths(root);
    const submodules = submodulePaths(root);
    const isExcluded = pathMatcher(exclude);
    return [...new Set(paths)]
        .filter(
            (path) =>
                !path.startsWith('.git/') &&
                path !== '.git' &&
                !LIFECYCLE_PRIVATE_PATH.test(path.normalize('NFC')) &&
                !submodules.some((module) => path === module || path.startsWith(`${module}/`)) &&
                !isExcluded(path),
        )
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
    const files = openConfinedRoot(root, 'native');
    let source: string;
    try {
        source = files.source(path);
    } finally {
        files.close();
    }
    const descriptor = openSync(source, 'r');
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
export function head(root: string, path: string, bytes = NATURE_HEAD_BYTES): string {
    return readPrefix(root, path, bytes).toString('utf8');
}

/**
 * Read required content, reusing source bytes only within the observed repository.
 * @param root the directory being read
 * @param path the source path relative to that directory
 * @param observations optional run-owned bytes; isolated generated output remains fresh
 * @returns the file bytes
 */
export function readSource(root: string, path: string, observations?: SourceObservations): Buffer {
    const observed = observations?.root === root ? observations.sources : undefined;
    const held = observed?.get(path);
    if (held !== undefined) return held;
    const files = openConfinedRoot(root, 'native');
    try {
        const bytes = readFileSync(files.source(path));
        observed?.set(path, bytes);
        return bytes;
    } finally {
        files.close();
    }
}
