// The file set: what git tracks or is about to track, or a gitignore-honoring walk without git.
import ignore from 'ignore';
import type { Stats } from 'node:fs';
import { isInside } from '#cli/platform/paths.ts';
import { join, posix, relative } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import { readSource } from '#cli/platform/source.ts';
import { runGitBlocking } from '#cli/platform/git.ts';
import { parseIndexEntries } from '#cli/parsers/git.ts';
import type { GitIndexEntry } from '#cli/types/parsers/git.ts';
import { LIFECYCLE_PRIVATE_PATH } from '#cli/config/platform/root.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import { isOutsideGit, inspectWorkTree } from '#cli/repository/root.ts';
import { statSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { EXECUTABLE_BITS, DEPENDENCY_FOLDERS } from '#cli/config/repository/inventory.ts';
import type { RawEntry, PathIgnore, PendingDirectory, DirectoryContents } from '#cli/types/repository/inventory.ts';

// A link to a folder, or one that leaves the repository, is left out, so no check reads past it. A dangling link is
// listed with no size.
function symlinkEntry(root: string, path: string): RawEntry | undefined {
    const link = { path, size: 0, executable: false, symlink: true };
    let target: string;
    try {
        target = realpathSync(join(root, path));
    } catch (error) {
        if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ELOOP'))
            return link;
        throw error;
    }
    if (!isInside(relative(realpathSync(root), target))) return undefined;
    const stat = statSync(target);
    return stat.isDirectory() ? undefined : { ...link, size: stat.size };
}

// Report parent replacements consistently whether the OS throws or returns no child stat.
function assertParents(root: string, path: string): void {
    const parts = path.split('/').slice(0, -1);
    let parent = '';
    for (const part of parts) {
        parent = parent === '' ? part : `${parent}/${part}`;
        const entry = statSync(join(root, parent), { throwIfNoEntry: false });
        if (entry === undefined) return;
        if (!entry.isDirectory())
            throw Object.assign(new Error(`Git lists ${path}, but ${parent} is now a file.`), { code: 'ENOTDIR' });
    }
}

function entryStat(root: string, path: string): Stats | undefined {
    try {
        return lstatSync(join(root, path), { throwIfNoEntry: false });
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOTDIR') assertParents(root, path);
        throw error;
    }
}

function getEntry(root: string, path: string, executables: ReadonlySet<string> | undefined): RawEntry | undefined {
    const stat = entryStat(root, path);
    if (stat === undefined) {
        assertParents(root, path);
        return undefined;
    }
    if (stat.isSymbolicLink()) {
        if (DEPENDENCY_FOLDERS.includes(posix.basename(path))) return undefined;
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
    const isExecutable = executables === undefined ? (stat.mode & EXECUTABLE_BITS) !== 0 : executables.has(path);
    return { path, size: stat.size, executable: isExecutable, symlink: false };
}

function directoryContents(root: string, directory: string, inherited: PathIgnore[]): DirectoryContents {
    const entries = readdirSync(join(root, directory), { withFileTypes: true });
    const rules = [...inherited];
    if (entries.some((entry) => entry.name === '.gitignore' && entry.isFile())) {
        rules.push({
            base: directory,
            matcher: ignore().add(readSource(root, `${directory}.gitignore`).toString('utf8')),
        });
    }
    return { entries, rules };
}

function isIgnored(candidate: string, rules: PathIgnore[]): boolean {
    let ignored = false;
    for (const { base, matcher } of rules) {
        const result = matcher.test(candidate.slice(base.length));
        if (result.ignored) ignored = true;
        else if (result.unignored) ignored = false;
    }
    return ignored;
}

function walkPaths(root: string): string[] {
    const paths: string[] = [];
    const pending: PendingDirectory[] = [{ directory: '', rules: [] }];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
        const { directory } = next;
        const { entries, rules } = directoryContents(root, directory, next.rules);
        const retained = entries.filter((entry) => {
            if (entry.name === '.git' || entry.isSymbolicLink()) return false;
            const path = `${directory}${entry.name}`;
            const candidate = entry.isDirectory() ? `${path}/` : path;
            return !isIgnored(candidate, rules) && !LIFECYCLE_PRIVATE_PATH.test(path.normalize('NFC'));
        });
        for (const entry of retained) {
            const path = `${directory}${entry.name}`;
            if (entry.isDirectory()) pending.push({ directory: `${path}/`, rules });
            else if (entry.isFile()) paths.push(path);
        }
    }
    return paths;
}

// Share Git listing failure classification while each caller owns its output format and non-Git behavior.
function listGitFiles(root: string, options: string[]): string | undefined {
    const listed = runGitBlocking(root, ['ls-files', ...options, '-z']);
    if (listed.code === 0) return listed.stdout;
    if (isOutsideGit(root, inspectWorkTree(root))) return undefined;
    throw new GspotError('selection', [
        `Git ls-files failed in ${root} (exit ${String(listed.code)}): ${listed.stderr.trim()}`,
    ]);
}

/**
 * Paths in the Git index, including tracked deletions. A non-Git directory has none.
 * @param root the repository root
 * @returns the indexed paths
 */
export function indexedPaths(root: string): string[] {
    return [...new Set(readIndexEntries(root).map((entry) => entry.path))];
}

/**
 * Read the index once for paths, executable bits, and gitlinks. A non-Git directory has none.
 * @param root the repository root
 * @returns validated entries, retaining stages of conflicted working files
 */
export function readIndexEntries(root: string): GitIndexEntry[] {
    const listed = listGitFiles(root, ['--stage']);
    return listed === undefined ? [] : parseIndexEntries(listed);
}

/**
 * Identify gitlinks without opening submodule directories or reading their configuration.
 * @param entries the shared index listing
 * @returns sorted, unique submodule paths
 */
export function getSubmodulePaths(entries: GitIndexEntry[]): string[] {
    return [...new Set(entries.filter((entry) => entry.mode === '160000').map((entry) => entry.path))].toSorted(
        (left, right) => left.localeCompare(right),
    );
}

/**
 * Tracked and about-to-be-tracked files, root-relative posix, sorted. Falls back to a gitignore walk without git.
 * @param root the repository root
 * @param exclude the paths to leave out
 * @returns the entries with size, executable bit, and symlink flag
 */
export function trackedEntries(root: string, exclude: string[] = []): RawEntry[] {
    const listed = listGitFiles(root, ['--cached', '--others', '--exclude-standard']);
    const paths = listed === undefined ? walkPaths(root) : listed.split('\0').filter((path) => path !== '');
    const index = readIndexEntries(root);
    const submodules = getSubmodulePaths(index);
    const isExcluded = pathMatcher(exclude);
    // Windows file systems keep no executable bit, so the same index listing supplies it.
    const executables =
        process.platform === 'win32'
            ? new Set(index.filter((entry) => entry.mode === '100755').map((entry) => entry.path))
            : undefined;
    return [...new Set(paths)]
        .filter(
            (path) =>
                !LIFECYCLE_PRIVATE_PATH.test(path.normalize('NFC')) &&
                !submodules.some((module) => isInScope(path, module)) &&
                !isExcluded(path),
        )
        .toSorted((a, b) => a.localeCompare(b))
        .map((path) => getEntry(root, path, executables))
        .filter((entry) => entry !== undefined);
}
